package com.ceventic.android;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public final class MainActivity extends Activity {
  private WebView web;
  private ValueCallback<Uri[]> fileCallback;
  private byte[] exportBytes;
  private GeolocationPermissions.Callback geoCallback;
  private String geoOrigin;
  private static final int FILE_PICK = 10, FILE_SAVE = 11, LOCATION = 12;
  private RecapStore store;

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    store = new RecapStore(this);
    android.widget.FrameLayout root = new android.widget.FrameLayout(this);
    NativeUi.inset(this, root);
    web = new WebView(this);
    root.addView(web, new android.widget.FrameLayout.LayoutParams(-1, -1));
    setContentView(root);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setMediaPlaybackRequiresUserGesture(true);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    web.setBackgroundColor(NativeUi.SURFACE);
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      WebViewCompat.addWebMessageListener(
          web,
          "CeventicAndroid",
          java.util.Set.of(BuildConfig.APP_ORIGIN),
          (view, message, origin, mainFrame, reply) -> {
            if (!mainFrame
                || !PeriodRules.trustedUrl(origin.toString())
                || !PeriodRules.trustedUrl(view.getUrl())) return;
            String id = "";
            try {
              String raw = message.getData();
              if (raw == null || raw.length() > 650000)
                throw new IllegalArgumentException("Message too large");
              JSONObject request = new JSONObject(raw);
              id = request.optString("id");
              if (id.length() > 80) throw new IllegalArgumentException("Invalid request");
              JSONObject data = request.optJSONObject("data");
              if (data == null) data = new JSONObject();
              Object result = new JSONObject();
              switch (request.optString("method")) {
                case "info":
                  result = info();
                  break;
                case "bind":
                  if (!store.hash().equals(data.optString("tokenHash"))
                      || data.optString("userId").isEmpty()
                      || data.optString("userId").length() > 100)
                    throw new IllegalArgumentException("Connection changed");
                  store.bind(
                      data.getString("userId"),
                      data.getLong("expiresAt"),
                      data.optString("accentHex"),
                      data.optString("locale"));
                  break;
                case "settings":
                  startActivity(new Intent(this, RecapSettingsActivity.class));
                  break;
                case "disconnect":
                  stopService(new Intent(this, UnlockRecapService.class));
                  store.disconnect();
                  break;
                case "saveFile":
                  if (exportBytes != null)
                    throw new IllegalStateException("Finish the current download first");
                  byte[] bytes = data.optString("content").getBytes(StandardCharsets.UTF_8);
                  if (bytes.length > 512000) throw new IllegalArgumentException("File too large");
                  exportBytes = bytes;
                  String filename =
                      data.optString("filename", "ceventic-plan.json")
                          .replaceAll("[^A-Za-z0-9._-]", "_");
                  filename = filename.substring(0, Math.min(80, filename.length()));
                  Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                  intent.addCategory(Intent.CATEGORY_OPENABLE);
                  intent.setType("application/json");
                  intent.putExtra(Intent.EXTRA_TITLE, filename);
                  startActivityForResult(intent, FILE_SAVE);
                  break;
                default:
                  throw new IllegalArgumentException("Unknown request");
              }
              reply.postMessage(new JSONObject().put("id", id).put("result", result).toString());
            } catch (Exception error) {
              try {
                reply.postMessage(
                    new JSONObject()
                        .put("id", id)
                        .put("error", "Could not complete this Android request.")
                        .toString());
              } catch (Exception ignored) {
              }
            }
          });
    }
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            String url = request.getUrl().toString();
            if (PeriodRules.trustedUrl(url)) return false;
            if ("https".equals(request.getUrl().getScheme())
                || "http".equals(request.getUrl().getScheme())) {
              try {
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
              } catch (Exception ignored) {
              }
            }
            return true;
          }

          @Override
          public void onReceivedSslError(
              WebView view,
              android.webkit.SslErrorHandler handler,
              android.net.http.SslError error) {
            handler.cancel();
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showNetworkError();
          }
        });
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onShowFileChooser(
              WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (!PeriodRules.trustedUrl(view.getUrl())) return false;
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            pick.putExtra(
                Intent.EXTRA_ALLOW_MULTIPLE,
                params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try {
              startActivityForResult(pick, FILE_PICK);
            } catch (Exception e) {
              fileCallback.onReceiveValue(null);
              fileCallback = null;
            }
            return true;
          }

          @Override
          public void onGeolocationPermissionsShowPrompt(
              String origin, GeolocationPermissions.Callback callback) {
            if (!PeriodRules.trustedUrl(origin)) {
              callback.invoke(origin, false, false);
              return;
            }
            if (checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
              callback.invoke(origin, true, false);
              return;
            }
            geoOrigin = origin;
            geoCallback = callback;
            new AlertDialog.Builder(MainActivity.this)
                .setTitle("Prayer times")
                .setMessage(
                    "Allow approximate location for prayer times while using Ceventic? Unlock"
                        + " recaps do not use location.")
                .setPositiveButton(
                    "Continue",
                    (d, w) ->
                        requestPermissions(
                            new String[] {android.Manifest.permission.ACCESS_COARSE_LOCATION},
                            LOCATION))
                .setNegativeButton(
                    "Not now",
                    (d, w) -> {
                      callback.invoke(origin, false, false);
                      geoCallback = null;
                    })
                .setOnCancelListener(
                    d -> {
                      callback.invoke(origin, false, false);
                      geoCallback = null;
                    })
                .show();
          }
        });
    web.loadUrl(BuildConfig.APP_ORIGIN + "/");
    if ("com.ceventic.android.OPEN_RECAP_SETTINGS".equals(getIntent().getAction()))
      startActivity(new Intent(this, RecapSettingsActivity.class));
  }

  private JSONObject info() throws Exception {
    return new JSONObject()
        .put("version", 1)
        .put("tokenHash", store.hash())
        .put("userId", store.user())
        .put("enabled", store.enabled())
        .put("expiresAt", store.expires())
        .put("label", "Ceventic Android Preview");
  }

  private void showNetworkError() {
    if (isFinishing() || isDestroyed()) return;
    LinearLayout content = NativeUi.column(this);
    content.setPadding(24, 24, 24, 24);
    content.addView(
        NativeUi.text(
            this,
            "Ceventic couldn’t load. Check your connection and retry.",
            16,
            Color.WHITE,
            false));
    content.addView(
        NativeUi.button(this, "Retry", () -> web.loadUrl(BuildConfig.APP_ORIGIN + "/")));
    content.addView(
        NativeUi.button(
            this,
            "Recap settings",
            () -> startActivity(new Intent(this, RecapSettingsActivity.class))));
    new AlertDialog.Builder(this).setView(content).setNegativeButton("Close", (d, w) -> {}).show();
  }

  @Override
  public void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == FILE_PICK && fileCallback != null) {
      fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
      fileCallback = null;
    }
    if (request == FILE_SAVE) {
      byte[] bytes = exportBytes;
      exportBytes = null;
      if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
        try (java.io.OutputStream out = getContentResolver().openOutputStream(data.getData())) {
          if (out != null) out.write(bytes);
        } catch (Exception e) {
          Toast.makeText(this, "Could not save the file.", Toast.LENGTH_LONG).show();
        }
      }
    }
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(request, permissions, grants);
    if (request == LOCATION && geoCallback != null) {
      geoCallback.invoke(
          geoOrigin, grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED, false);
      geoCallback = null;
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    if (store != null
        && store.enabled()
        && (store.everyUnlock() || !store.user().isEmpty())
        && android.provider.Settings.canDrawOverlays(this)) {
      try {
        startForegroundService(new Intent(this, UnlockRecapService.class));
      } catch (Exception ignored) {
        store.error("Open Recap settings to resume monitoring.");
      }
    }
  }

  @Override
  public void onBackPressed() {
    if (web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  @Override
  public void onDestroy() {
    if (fileCallback != null) fileCallback.onReceiveValue(null);
    exportBytes = null;
    if (web != null) {
      web.stopLoading();
      web.destroy();
    }
    super.onDestroy();
  }
}
