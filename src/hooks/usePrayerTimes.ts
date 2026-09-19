import { useEffect, useMemo, useState } from "react";
import { getLocalDateKey } from "./useLocalDateKey";

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type ActivePrayerWindow = {
  name: PrayerName;
  label: string;
  time: string;
  startsAt: Date;
  endsAt: Date;
  sessionKey: string;
};

type PrayerTimes = Record<PrayerName, string>;

type CachedLocation = {
  latitude: number;
  longitude: number;
  timeZone: string;
  savedAt: number;
};

type CachedTimings = {
  dateKey: string;
  latitude: number;
  longitude: number;
  method: number;
  timings: PrayerTimes;
  savedAt: number;
};

const LOCATION_KEY = "ceventic_prayer_location_v1";
const TIMINGS_KEY = "ceventic_prayer_timings_v1";
const PRAYERS: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const LOCATION_MAX_AGE = 12 * 60 * 60 * 1000;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function methodForTimeZone(timeZone: string) {
  if (timeZone === "Asia/Kuwait") return 9;
  if (timeZone === "Asia/Qatar") return 10;
  if (timeZone === "Asia/Riyadh") return 4;
  if (timeZone === "Asia/Dubai" || timeZone === "Asia/Muscat") return 8;
  if (timeZone === "Africa/Cairo") return 5;
  if (timeZone === "Europe/Istanbul") return 13;
  if (timeZone === "Asia/Kuala_Lumpur") return 17;
  if (timeZone === "Asia/Singapore") return 11;
  if (timeZone === "Africa/Tunis") return 18;
  if (timeZone === "Africa/Algiers") return 19;
  if (timeZone === "Africa/Casablanca") return 21;
  if (timeZone === "Europe/Lisbon" || timeZone === "Atlantic/Madeira") return 22;
  if (timeZone === "Asia/Amman") return 23;
  if (timeZone.startsWith("Asia/Jakarta") || timeZone.startsWith("Asia/Makassar") || timeZone.startsWith("Asia/Jayapura")) return 20;
  if (timeZone.startsWith("America/")) return 2;
  if (timeZone === "Asia/Karachi") return 1;
  if (timeZone === "Europe/Paris") return 12;
  if (timeZone === "Europe/Moscow") return 14;
  return 3;
}

function fallbackLocationForTimeZone(timeZone: string): Pick<CachedLocation, "latitude" | "longitude"> | null {
  const locations: Record<string, { latitude: number; longitude: number }> = {
    "Asia/Kuwait": { latitude: 29.3759, longitude: 47.9774 },
    "Asia/Qatar": { latitude: 25.2854, longitude: 51.5310 },
    "Asia/Riyadh": { latitude: 24.7136, longitude: 46.6753 },
    "Asia/Dubai": { latitude: 25.2048, longitude: 55.2708 },
    "Asia/Muscat": { latitude: 23.5880, longitude: 58.3829 },
    "Africa/Cairo": { latitude: 30.0444, longitude: 31.2357 },
    "Europe/Istanbul": { latitude: 41.0082, longitude: 28.9784 },
    "Asia/Kuala_Lumpur": { latitude: 3.1390, longitude: 101.6869 },
    "Asia/Singapore": { latitude: 1.3521, longitude: 103.8198 },
    "Africa/Tunis": { latitude: 36.8065, longitude: 10.1815 },
    "Africa/Algiers": { latitude: 36.7538, longitude: 3.0588 },
    "Africa/Casablanca": { latitude: 33.5731, longitude: -7.5898 },
    "Europe/Lisbon": { latitude: 38.7223, longitude: -9.1393 },
    "Asia/Amman": { latitude: 31.9539, longitude: 35.9106 },
    "Asia/Karachi": { latitude: 24.8607, longitude: 67.0011 },
    "Europe/Paris": { latitude: 48.8566, longitude: 2.3522 },
    "Europe/Moscow": { latitude: 55.7558, longitude: 37.6173 },
  };
  return locations[timeZone] ?? null;
}

function normalizeApiTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function prayerDate(dateKey: string, hhmm: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function apiDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}-${month}-${year}`;
}

async function getLocation(timeZone: string): Promise<CachedLocation | null> {
  const cached = readJson<CachedLocation>(LOCATION_KEY);
  if (
    cached &&
    cached.timeZone === timeZone &&
    Number.isFinite(cached.latitude) &&
    Number.isFinite(cached.longitude) &&
    Date.now() - cached.savedAt < LOCATION_MAX_AGE
  ) {
    return cached;
  }

  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30 * 60 * 1000,
        });
      });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timeZone,
        savedAt: Date.now(),
      };
      writeJson(LOCATION_KEY, next);
      return next;
    } catch {}
  }

  const fallback = fallbackLocationForTimeZone(timeZone);
  if (!fallback) return null;
  return { ...fallback, timeZone, savedAt: Date.now() };
}

export function usePrayerTimes(enabled: boolean) {
  const [now, setNow] = useState(() => new Date());
  const [timings, setTimings] = useState<PrayerTimes | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const dateKey = getLocalDateKey(now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setStatus("idle");
      setTimings(null);
      return;
    }

    const load = async () => {
      setStatus("loading");
      const location = await getLocation(timeZone);
      if (!location || cancelled) {
        if (!cancelled) setStatus("unavailable");
        return;
      }
      const method = methodForTimeZone(timeZone);
      const cached = readJson<CachedTimings>(TIMINGS_KEY);
      const sameCoordinates = cached && Math.abs(cached.latitude - location.latitude) < 0.02 && Math.abs(cached.longitude - location.longitude) < 0.02;
      if (cached && cached.dateKey === dateKey && cached.method === method && sameCoordinates) {
        setTimings(cached.timings);
        setStatus("ready");
        return;
      }

      try {
        const url = `https://api.aladhan.com/v1/timings/${apiDate(dateKey)}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&method=${method}`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Prayer time request failed");
        const payload = await response.json();
        const source = payload?.data?.timings ?? {};
        const next = {} as PrayerTimes;
        for (const prayer of PRAYERS) {
          const value = normalizeApiTime(source[prayer]);
          if (!value) throw new Error(`Missing ${prayer} time`);
          next[prayer] = value;
        }
        if (cancelled) return;
        setTimings(next);
        setStatus("ready");
        writeJson(TIMINGS_KEY, {
          dateKey,
          latitude: location.latitude,
          longitude: location.longitude,
          method,
          timings: next,
          savedAt: Date.now(),
        } satisfies CachedTimings);
      } catch {
        if (!cancelled) {
          setTimings(null);
          setStatus("unavailable");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, dateKey, timeZone]);

  const activePrayer = useMemo<ActivePrayerWindow | null>(() => {
    if (!enabled || !timings) return null;
    for (const name of PRAYERS) {
      const startsAt = prayerDate(dateKey, timings[name]);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      if (now >= startsAt && now < endsAt) {
        return {
          name,
          label: name === "Dhuhr" ? "Dhuhr" : name,
          time: timings[name],
          startsAt,
          endsAt,
          sessionKey: `prayer:${dateKey}:${name.toLowerCase()}`,
        };
      }
    }
    return null;
  }, [enabled, timings, now, dateKey]);

  return { now, dateKey, timings, activePrayer, status };
}
