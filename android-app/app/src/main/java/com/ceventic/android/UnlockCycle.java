package com.ceventic.android;

/** Coalesces SCREEN_ON and USER_PRESENT without suppressing the next real wake. */
final class UnlockCycle {
  private boolean delivered;

  boolean claim() {
    if (delivered) return false;
    delivered = true;
    return true;
  }

  void screenOff() {
    delivered = false;
  }
}
