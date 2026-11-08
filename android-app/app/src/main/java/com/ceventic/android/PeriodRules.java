package com.ceventic.android;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

final class PeriodRules {
  static String closedEnd(String kind, LocalDate today) {
    return switch (kind) {
      case "day" -> today.minusDays(1).toString();
      case "week" ->
          today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusDays(1).toString();
      case "month" -> today.withDayOfMonth(1).minusDays(1).toString();
      default -> "";
    };
  }

  static boolean due(String kind, String end, String acknowledged, LocalDate today) {
    return !closedEnd(kind, today).isEmpty()
        && closedEnd(kind, today).equals(end)
        && end.compareTo(acknowledged == null ? "" : acknowledged) > 0;
  }

  static boolean trustedUrl(String url) {
    try {
      java.net.URI uri = new java.net.URI(url);
      return "https".equals(uri.getScheme())
          && "ceventic.vercel.app".equals(uri.getHost())
          && (uri.getPort() == -1 || uri.getPort() == 443)
          && uri.getUserInfo() == null;
    } catch (Exception e) {
      return false;
    }
  }
}
