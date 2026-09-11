// Shared, side-effect-free calculations used by the API, UI and regression tests.
export type ProgressMetric = "routines" | "workouts" | "habits";
export type ProgressDay = {
  date: string;
  routines: number | null;
  workouts: number | null;
  habits: number | null;
  tasksDone: number;
  exercisesDone: number;
  habitsDone: number;
  workoutsCompleted: number;
};

export function percentage(done: number, total: number): number | null {
  return total > 0 ? Math.min(100, Math.max(0, done / total * 100)) : null;
}

export function meanRecorded(values: (number | null)[]): number | null {
  const recorded = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return recorded.length ? recorded.reduce((sum, value) => sum + value, 0) / recorded.length : null;
}

export function dateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function aggregateProgress(days: ProgressDay[], metric: ProgressMetric, group: "day" | "week" | "month") {
  const buckets = new Map<string, ProgressDay[]>();
  for (const day of days) {
    let key = day.date;
    if (group === "month") key = key.slice(0, 7) + "-01";
    if (group === "week") {
      const date = new Date(`${key}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      key = date.toISOString().slice(0, 10);
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(day);
    buckets.set(key, bucket);
  }
  return Array.from(buckets, ([key, bucket]) => ({
    key, value: meanRecorded(bucket.map(day => day[metric])),
    recorded: bucket.filter(day => day[metric] !== null).length, days: bucket.length,
  }));
}

export type ExerciseResult = {
  exerciseId: string;
  name: string;
  reps?: number;
  weightKg?: number;
  holdSeconds?: number;
};

// Only compare like-for-like sets. No invented strength score across exercises.
export function compareResults(current: ExerciseResult, previous: ExerciseResult): string | null {
  if (current.exerciseId !== previous.exerciseId) return null;
  if (current.holdSeconds !== undefined && previous.holdSeconds !== undefined) {
    const delta = Math.round((current.holdSeconds - previous.holdSeconds) * 10) / 10;
    return delta === 0 ? "Same hold as last time" : `${delta > 0 ? "+" : ""}${delta}s hold vs last time`;
  }
  if (current.reps !== undefined && previous.reps !== undefined && current.weightKg === previous.weightKg) {
    const delta = current.reps - previous.reps;
    return delta === 0 ? "Same reps at the same load" : `${delta > 0 ? "+" : ""}${delta} reps at the same load`;
  }
  if (current.reps !== undefined && current.reps === previous.reps && current.weightKg !== undefined && previous.weightKg !== undefined) {
    const delta = Math.round((current.weightKg - previous.weightKg) * 100) / 100;
    return `${delta > 0 ? "+" : ""}${delta} kg at the same reps`;
  }
  return null;
}

export function compareCompletedWeeks(days: ProgressDay[], metric: ProgressMetric) {
  const summarize = (week: ProgressDay[]) => ({
    start: week[0]?.date, end: week[week.length - 1]?.date,
    average: meanRecorded(week.map(day => day[metric])),
    recordedDays: week.filter(day => day[metric] !== null).length,
    completions: week.reduce((sum, day) => sum + (metric === "routines" ? day.tasksDone : metric === "habits" ? day.habitsDone : day.workoutsCompleted), 0),
  });
  // Exclude the in-progress current day. Compare two equal seven-calendar-day windows.
  const current = summarize(days.slice(-8, -1));
  const previous = summarize(days.slice(-15, -8));
  return { current, previous, delta: current.average === null || previous.average === null ? null : current.average - previous.average };
}
