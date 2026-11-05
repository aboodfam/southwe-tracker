import { expect, test } from "vitest";
import { currentPrayerSessionKey, prayerSessionName } from "../src/lib/prayerSessions";
const timings = {Fajr: "05:00", Dhuhr: "12:00", Asr: "15:00", Maghrib: "17:00", Isha: "19:00"};
test("prayer counters belong to each dated prayer, while the daily fallback changes at midnight", () => {
  expect(currentPrayerSessionKey(new Date(2026, 10, 2, 12), null)).toBe("prayer:2026-11-02:manual");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 12), null)).toBe("prayer:2026-11-05:manual");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 4, 59), timings)).toBe("prayer:2026-11-04:isha");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 5), timings)).toBe("prayer:2026-11-05:fajr");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 11, 59), timings)).toBe("prayer:2026-11-05:fajr");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 12), timings)).toBe("prayer:2026-11-05:dhuhr");
  expect(currentPrayerSessionKey(new Date(2026, 10, 5, 19), timings)).toBe("prayer:2026-11-05:isha");
  expect(prayerSessionName("prayer:2026-11-05:manual")).toBeNull();
  expect(prayerSessionName("prayer:2026-11-05:maghrib")).toBe("Maghrib");
});
