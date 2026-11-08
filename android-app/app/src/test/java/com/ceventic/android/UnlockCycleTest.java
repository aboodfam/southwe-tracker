package com.ceventic.android;

import static org.junit.Assert.*;

import org.junit.Test;

public class UnlockCycleTest {
  @Test
  public void screenOnAndUserPresentAreOneWakeButNextWakeIsNotSuppressed() {
    UnlockCycle c = new UnlockCycle();
    assertTrue(c.claim());
    assertFalse(c.claim());
    c.screenOff();
    assertTrue(c.claim());
    assertFalse(c.claim());
  }

  @Test
  public void repeatedScreenOffEventsAreHarmless() {
    UnlockCycle c = new UnlockCycle();
    c.screenOff();
    c.screenOff();
    assertTrue(c.claim());
    assertFalse(c.claim());
  }
}
