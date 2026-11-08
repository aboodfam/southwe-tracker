import { parseUtcDateKey, shiftUtcDateKey } from "./date";
export type RecapKind = "day" | "week" | "month";
export function closedRecapPeriods(today: string) {
  const date = parseUtcDateKey(today);
  const monday = shiftUtcDateKey(today, -((date.getUTCDay() + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const previousMonthEnd = shiftUtcDateKey(monthStart, -1);
  return [
    {
      kind: "month" as const,
      start: `${previousMonthEnd.slice(0, 7)}-01`,
      end: previousMonthEnd,
    },
    {
      kind: "week" as const,
      start: shiftUtcDateKey(monday, -7),
      end: shiftUtcDateKey(monday, -1),
    },
    {
      kind: "day" as const,
      start: shiftUtcDateKey(today, -1),
      end: shiftUtcDateKey(today, -1),
    },
  ];
}
export function validDeviceHash(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}
export async function hashDeviceToken(token: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
