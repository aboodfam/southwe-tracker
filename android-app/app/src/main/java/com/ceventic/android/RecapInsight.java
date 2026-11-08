package com.ceventic.android;

import org.json.*;

/** Deterministic copy selected from actual aggregates; never a generated score. */
final class RecapInsight {
  static final String[] FIELDS = {"exercises", "tasks", "habits", "athkar", "workouts"};
  final String field, headline, description;
  final boolean comparable;
  final int current, previous, currentCoverage, previousCoverage;

  private RecapInsight(
      JSONObject p, String field, String headline, String description, boolean comparable) {
    this.field = field;
    this.headline = headline;
    this.description = description;
    this.comparable = comparable;
    current = Math.max(0, p.optInt(field));
    JSONObject before = p.optJSONObject("previous");
    previous = before == null ? 0 : Math.max(0, before.optInt(field));
    currentCoverage = coverage(p, field);
    previousCoverage = coverage(before, field);
  }

  static int coverage(JSONObject p, String field) {
    JSONObject recorded = p == null ? null : p.optJSONObject("recordedDays");
    return recorded == null ? 0 : Math.max(0, recorded.optInt(field));
  }

  static String label(String field) {
    return switch (field) {
      case "tasks" -> "Tasks done";
      case "habits" -> "Habit check-ins";
      case "athkar" -> "Athkar sessions";
      case "workouts" -> "Workouts saved";
      default -> "Exercises checked";
    };
  }

  private static boolean visible(JSONObject p, String field) {
    String page =
        switch (field) {
          case "tasks" -> "routines";
          case "habits" -> "habits";
          case "athkar" -> "athkar";
          default -> "workout";
        };
    JSONArray hidden = p.optJSONArray("hiddenPages");
    if (hidden != null)
      for (int i = 0; i < hidden.length(); i++) if (page.equals(hidden.optString(i))) return false;
    return true;
  }

  static RecapInsight from(JSONObject p) {
    JSONObject before = p.optJSONObject("previous");
    String fallback = "";
    for (String field : FIELDS)
      if (visible(p, field) && p.optInt(field) > 0) {
        fallback = field;
        break;
      }
    if (before != null) {
      // Highlight one concrete improvement, not an unsupported verdict about the whole person.
      for (String field : FIELDS) {
        if (visible(p, field)
            && coverage(p, field) > 0
            && coverage(before, field) > 0
            && p.optInt(field) > before.optInt(field)) {
          return new RecapInsight(
              p,
              field,
              p.optBoolean("recordedGoalsComplete")
                  ? "Recorded goals complete."
                  : switch (field) {
                    case "tasks" -> "More tasks completed.";
                    case "habits" -> "More habit check-ins.";
                    case "athkar" -> "More Athkar sessions.";
                    case "workouts" -> "More workouts saved.";
                    default -> "More exercises checked.";
                  },
              p.optBoolean("recordedGoalsComplete")
                  ? "Every recorded goal with a target was completed."
                  : "A step forward in your recorded activity.",
              true);
        }
      }
      for (String field : FIELDS) {
        if (visible(p, field)
            && coverage(p, field) > 0
            && coverage(before, field) > 0
            && (p.optInt(field) > 0 || before.optInt(field) > 0)) {
          boolean steady = p.optInt(field) == before.optInt(field);
          return new RecapInsight(
              p,
              field,
              p.optBoolean("recordedGoalsComplete")
                  ? "Recorded goals complete."
                  : steady ? "You kept your rhythm." : "Room to build again.",
              p.optBoolean("recordedGoalsComplete")
                  ? "Every recorded goal with a target was completed."
                  : steady
                      ? "You matched your previous recorded total."
                      : "A quieter recorded total. Start again at your own pace.",
              true);
        }
      }
    }
    return new RecapInsight(
        p,
        fallback,
        p.optBoolean("recordedGoalsComplete")
            ? "Recorded goals complete."
            : "Your progress starts here.",
        p.optBoolean("recordedGoalsComplete")
            ? "Every recorded goal with a target was completed."
            : "Not enough history to compare yet. Each record builds your picture.",
        false);
  }
}
