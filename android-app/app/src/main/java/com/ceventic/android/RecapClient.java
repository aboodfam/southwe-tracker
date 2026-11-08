package com.ceventic.android;

import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.json.JSONObject;

final class RecapClient {
  static JSONObject sync(RecapStore store) throws Exception {
    String hash = store.hash(), token = store.token(), priorUser = store.user();
    HttpURLConnection connection =
        (HttpURLConnection) new URL(BuildConfig.RECAP_ENDPOINT).openConnection();
    connection.setConnectTimeout(12000);
    connection.setReadTimeout(12000);
    connection.setInstanceFollowRedirects(false);
    connection.setRequestMethod("POST");
    connection.setRequestProperty("Authorization", "Bearer " + token);
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setDoOutput(true);
    try {
      byte[] body =
          new JSONObject()
              .put("dateKey", LocalDate.now().toString())
              .toString()
              .getBytes(StandardCharsets.UTF_8);
      try (java.io.OutputStream out = connection.getOutputStream()) {
        out.write(body);
      }
      int status = connection.getResponseCode();
      if (status == 401) {
        if (store.hash().equals(hash)) store.disconnect();
        throw new IllegalStateException("Connect your account again in Recap settings.");
      }
      if (status != 200)
        throw new IllegalStateException("Recap sync is unavailable. Please try again later.");
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      try (java.io.InputStream in = connection.getInputStream()) {
        byte[] buffer = new byte[4096];
        int count;
        while ((count = in.read(buffer)) != -1) {
          if (bytes.size() + count > 131072)
            throw new IllegalStateException("Invalid recap response.");
          bytes.write(buffer, 0, count);
        }
      }
      JSONObject data = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
      if (data.optInt("version") != 1
          || !LocalDate.now().toString().equals(data.optString("localDate"))
          || data.optString("userId").isEmpty()
          || !data.has("periods")
          || data.getJSONArray("periods").length() > 3
          || data.optLong("expiresAt") <= System.currentTimeMillis())
        throw new IllegalStateException("Invalid recap response.");
      if (!store.hash().equals(hash)
          || (!priorUser.isEmpty() && !priorUser.equals(data.optString("userId"))))
        throw new IllegalStateException("Account changed. Sync again.");
      store.bind(
          data.getString("userId"),
          data.getLong("expiresAt"),
          data.optString("accentHex"),
          data.optString("locale"));
      store.cache(data);
      return data;
    } finally {
      connection.disconnect();
    }
  }
}
