package com.ceventic.android;

import static org.junit.Assert.*;

import java.time.LocalDate;
import org.junit.Test;

public class PeriodRulesTest {
  @Test
  public void onlyClosedPeriodsAreEligible() {
    LocalDate day = LocalDate.parse("2024-03-01");
    assertEquals("2024-02-29", PeriodRules.closedEnd("month", day));
    assertEquals("2024-02-25", PeriodRules.closedEnd("week", day));
    assertEquals("2024-02-29", PeriodRules.closedEnd("day", day));
    assertFalse(PeriodRules.due("day", "2024-03-01", "", day));
    assertFalse(PeriodRules.due("unknown", "2024-02-29", "", day));
  }

  @Test
  public void shownPeriodsDoNotRepeatAndNewPeriodsBecomeDue() {
    LocalDate day = LocalDate.parse("2026-01-05");
    assertEquals("2026-01-04", PeriodRules.closedEnd("week", day));
    assertTrue(PeriodRules.due("week", "2026-01-04", "2025-12-28", day));
    assertFalse(PeriodRules.due("week", "2026-01-04", "2026-01-04", day));
    assertFalse(PeriodRules.due("week", "2026-01-04", "2026-01-11", day));
    assertEquals("2025-12-31", PeriodRules.closedEnd("month", LocalDate.parse("2026-01-01")));
  }

  @Test
  public void bridgeAndNavigationRejectUntrustedOrLookalikeOrigins() {
    assertTrue(PeriodRules.trustedUrl("https://ceventic.vercel.app/"));
    assertTrue(PeriodRules.trustedUrl("https://ceventic.vercel.app/privacy"));
    for (String s :
        new String[] {
          "http://ceventic.vercel.app/",
          "https://ceventic.vercel.app.evil.test/",
          "https://evil.test@ceventic.vercel.app/",
          "file:///etc/passwd",
          "javascript:alert(1)",
          "https://ceventic.vercel.app:444/"
        }) assertFalse(s, PeriodRules.trustedUrl(s));
  }
}
