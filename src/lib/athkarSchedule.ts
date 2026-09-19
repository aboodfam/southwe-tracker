import { getLocalDateKey } from "../hooks/useLocalDateKey";

export type ScheduledAthkarCategory = "waking_up" | "morning" | "evening" | "before_sleep";

export type ScheduledAthkarWindow = {
  category: ScheduledAthkarCategory;
  title: string;
  shortLabel: string;
  windowKey: string;
  startsAt: string;
  endsAt: string;
};

export function getScheduledAthkarWindow(date: Date = new Date()): ScheduledAthkarWindow | null {
  const hour = date.getHours();
  const windowKey = getLocalDateKey(date);

  if (hour >= 1 && hour < 5) {
    return { category: "waking_up", title: "Waking Up Athkar", shortLabel: "Wake", windowKey, startsAt: "1:00 AM", endsAt: "5:00 AM" };
  }
  if (hour >= 5 && hour < 12) {
    return { category: "morning", title: "Morning Athkar", shortLabel: "Morning", windowKey, startsAt: "5:00 AM", endsAt: "12:00 PM" };
  }
  if (hour >= 12 && hour < 18) {
    return { category: "evening", title: "Evening Athkar", shortLabel: "Evening", windowKey, startsAt: "12:00 PM", endsAt: "6:00 PM" };
  }
  if (hour >= 18 && hour < 22) {
    return { category: "before_sleep", title: "Sleeping Athkar", shortLabel: "Sleep", windowKey, startsAt: "6:00 PM", endsAt: "10:00 PM" };
  }
  return null;
}
