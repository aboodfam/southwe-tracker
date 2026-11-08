import { parseUtcDateKey, shiftUtcDateKey } from "./date";
import { dateRange, type ProgressDay } from "./progressMath";
export type RecapKind = "day" | "week" | "month";
export type RecapPeriod = { kind: RecapKind; start: string; end: string };

export function previousRecapPeriod(period: RecapPeriod): RecapPeriod {
  const end = shiftUtcDateKey(period.start, -1);
  const start =
    period.kind === "month"
      ? `${end.slice(0, 7)}-01`
      : period.kind === "week"
        ? shiftUtcDateKey(end, -6)
        : end;
  return { kind: period.kind, start, end };
}

// Only explicit records support comparisons. An absent log is never a failed day.
export function recapTotals(
  period: RecapPeriod,
  history: ProgressDay[],
  athkarDates: string[],
  hidden: string[],
) {
  const days = history
    .filter((day) => day.date >= period.start && day.date <= period.end)
    .map((day) => ({
      date: day.date,
      tasks: hidden.includes("routines") ? 0 : day.tasksDone,
      habits: hidden.includes("habits") ? 0 : day.habitsDone,
      exercises: hidden.includes("workout") ? 0 : day.exercisesDone,
      workouts: hidden.includes("workout") ? 0 : day.workoutsCompleted,
      athkar: hidden.includes("athkar")
        ? 0
        : athkarDates.filter((date) => date === day.date).length,
      recorded: {
        tasks: !hidden.includes("routines") && day.routines !== null,
        habits: !hidden.includes("habits") && day.habits !== null,
        exercises: !hidden.includes("workout") && day.workouts !== null,
        workouts: !hidden.includes("workout") && day.workouts !== null,
        athkar: !hidden.includes("athkar") && athkarDates.includes(day.date),
      },
    }));
  const fields = [
    "tasks",
    "habits",
    "exercises",
    "workouts",
    "athkar",
  ] as const;
  const counts = Object.fromEntries(
    fields.map((field) => [
      field,
      days.reduce((sum, day) => sum + day[field], 0),
    ]),
  ) as Record<(typeof fields)[number], number>;
  const recordedDays = Object.fromEntries(
    fields.map((field) => [
      field,
      days.filter((day) => day.recorded[field]).length,
    ]),
  ) as Record<(typeof fields)[number], number>;
  const trackedRates = history
    .filter((day) => day.date >= period.start && day.date <= period.end)
    .map((day) =>
      [
        hidden.includes("routines") ? null : day.routines,
        hidden.includes("habits") ? null : day.habits,
        hidden.includes("workout") ? null : day.workouts,
      ].filter((rate): rate is number => rate !== null),
    );
  const totalDays = dateRange(period.start, period.end).length;
  return {
    ...period,
    ...counts,
    totalDays,
    activeDays: days.filter((day) => fields.some((field) => day[field] > 0))
      .length,
    recordedDays,
    // This explicitly refers only to recorded goals with known denominators.
    recordedGoalsComplete:
      trackedRates.length === totalDays &&
      trackedRates.every(
        (rates) => rates.length > 0 && rates.every((rate) => rate === 100),
      ),
    days,
  };
}
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
