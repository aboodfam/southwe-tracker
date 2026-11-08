package com.ceventic.android;

import android.content.*;

public final class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    RecapStore store = new RecapStore(context);
    if (!store.enabled()) return;
    try {
      context.startForegroundService(new Intent(context, UnlockRecapService.class));
    } catch (Exception error) {
      store.error("Android paused monitoring after restart. Open Ceventic Preview to resume.");
    }
  }
}
