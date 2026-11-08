package com.ceventic.android;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class RecapStore {
  private static final String ALIAS = "ceventic_recap_credential_v1";
  private static final Object LOCK = new Object();
  private final SharedPreferences prefs;
  private final Context context;

  RecapStore(Context context) {
    this.context = context.getApplicationContext();
    prefs = context.getSharedPreferences("native_recaps", Context.MODE_PRIVATE);
  }

  void listen(SharedPreferences.OnSharedPreferenceChangeListener listener) {
    prefs.registerOnSharedPreferenceChangeListener(listener);
  }

  void unlisten(SharedPreferences.OnSharedPreferenceChangeListener listener) {
    prefs.unregisterOnSharedPreferenceChangeListener(listener);
  }

  private SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
    KeyGenerator generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(
        new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
    return generator.generateKey();
  }

  String token() throws Exception {
    synchronized (LOCK) {
      String encrypted = prefs.getString("credential", null);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      if (encrypted != null) {
        String[] fields = encrypted.split(":");
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            new GCMParameterSpec(128, Base64.decode(fields[0], Base64.NO_WRAP)));
        return new String(
            cipher.doFinal(Base64.decode(fields[1], Base64.NO_WRAP)),
            java.nio.charset.StandardCharsets.UTF_8);
      }
      byte[] bytes = new byte[32];
      new SecureRandom().nextBytes(bytes);
      String token =
          Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
      cipher.init(Cipher.ENCRYPT_MODE, key());
      String value =
          Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
              + ":"
              + Base64.encodeToString(
                  cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                  Base64.NO_WRAP);
      prefs.edit().putString("credential", value).commit();
      return token;
    }
  }

  String hash() throws Exception {
    byte[] bytes =
        MessageDigest.getInstance("SHA-256")
            .digest(token().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    StringBuilder out = new StringBuilder();
    for (byte b : bytes) out.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
    return out.toString();
  }

  String user() {
    return prefs.getString("user", "");
  }

  String accent() {
    return prefs.getString("accent", "#A3A3A3");
  }

  String locale() {
    return prefs.getString("locale", "en");
  }

  boolean enabled() {
    return prefs.getBoolean("enabled", false);
  }

  void enabled(boolean value) {
    prefs.edit().putBoolean("enabled", value).commit();
  }

  // This preview build defaults to the explicitly requested every-unlock behavior.
  boolean everyUnlock() {
    return prefs.getBoolean("every_unlock", true);
  }

  void everyUnlock(boolean value) {
    prefs.edit().putBoolean("every_unlock", value).commit();
  }

  void detectedUnlock() {
    prefs
        .edit()
        .putLong("last_unlock", System.currentTimeMillis())
        .putInt("unlock_count", unlockCount() + 1)
        .apply();
  }

  int unlockCount() {
    return prefs.getInt("unlock_count", 0);
  }

  long lastUnlock() {
    return prefs.getLong("last_unlock", 0);
  }

  void screenShown() {
    prefs.edit().putLong("last_shown", System.currentTimeMillis()).apply();
  }

  long lastShown() {
    return prefs.getLong("last_shown", 0);
  }

  boolean selected(String kind) {
    return prefs.getBoolean("show_" + kind, true);
  }

  void selected(String kind, boolean selected) {
    prefs.edit().putBoolean("show_" + kind, selected).commit();
  }

  String acknowledged(String kind) {
    return prefs.getString("ack_" + kind, "");
  }

  void acknowledge(String kind, String end) {
    if (end.compareTo(acknowledged(kind)) > 0) prefs.edit().putString("ack_" + kind, end).commit();
  }

  String error() {
    return prefs.getString("error", "");
  }

  void error(String value) {
    prefs.edit().putString("error", value).apply();
  }

  long expires() {
    return prefs.getLong("expires", 0);
  }

  void bind(String userId, long expires, String accent, String locale) {
    if (!user().isEmpty() && !user().equals(userId)) {
      clearAccount();
    }
    String safeAccent = accent.matches("#[A-Fa-f0-9]{6}") ? accent : "#A3A3A3";
    String safeLocale =
        java.util.Set.of("en", "ar", "es", "fr", "zh").contains(locale) ? locale : "en";
    prefs
        .edit()
        .putString("user", userId)
        .putLong("expires", expires)
        .putString("accent", safeAccent)
        .putString("locale", safeLocale)
        .putString("error", "")
        .commit();
  }

  JSONObject cache() {
    try {
      return new JSONObject(prefs.getString("cache", "{}"));
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  void cache(JSONObject data) {
    prefs
        .edit()
        .putString("cache", data.toString())
        .putLong("synced", System.currentTimeMillis())
        .putString("error", "")
        .commit();
  }

  long synced() {
    return prefs.getLong("synced", 0);
  }

  private void clearAccount() {
    prefs
        .edit()
        .remove("user")
        .remove("cache")
        .remove("expires")
        .remove("synced")
        .remove("ack_day")
        .remove("ack_week")
        .remove("ack_month")
        .putBoolean("enabled", false)
        .commit();
  }

  void disconnect() {
    synchronized (LOCK) {
      context.stopService(new android.content.Intent(context, UnlockRecapService.class));
      clearAccount();
      prefs.edit().remove("credential").remove("error").commit();
      try {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        ks.deleteEntry(ALIAS);
      } catch (Exception ignored) {
      }
    }
  }
}
