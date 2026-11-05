import { getLocalDateKey } from "../hooks/useLocalDateKey";

export const PRAYER_NAMES = [
  "Fajr",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];
export type PrayerTimings = Record<PrayerName, string>;
export const dailyPrayerSessionKey = (dateKey: string) =>
  `prayer:${dateKey}:manual`;

/** A separate occurrence per prayer. Location-free use gets a fresh daily session. */
export function currentPrayerSessionKey(
  now: Date,
  timings: PrayerTimings | null,
): string {
  const dateKey = getLocalDateKey(now);
  if (!timings) return dailyPrayerSessionKey(dateKey);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const latest = [...PRAYER_NAMES].reverse().find((name) => {
    const [hour, minute] = timings[name].split(":").map(Number);
    return hour * 60 + minute <= minutes;
  });
  if (latest) return `prayer:${dateKey}:${latest.toLowerCase()}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return `prayer:${getLocalDateKey(yesterday)}:isha`;
}

export function prayerSessionName(key: string): PrayerName | null {
  return (
    PRAYER_NAMES.find((name) => key.endsWith(`:${name.toLowerCase()}`)) ?? null
  );
}
