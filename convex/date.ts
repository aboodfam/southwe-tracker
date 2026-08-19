export function getUtcDateKey(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function parseUtcDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}


export function assertDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date");
  }

  const parsed = parseUtcDateKey(dateKey);
  if (Number.isNaN(parsed.getTime()) || getUtcDateKey(parsed) !== dateKey) {
    throw new Error("Invalid date");
  }

  return dateKey;
}

export function shiftUtcDateKey(dateKey: string, days: number) {
  const date = parseUtcDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return getUtcDateKey(date);
}

export function getUtcDateKeyDaysAgo(daysAgo: number, baseDate: Date = new Date()) {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return getUtcDateKey(date);
}

export function getUtcMonthStartKey(monthsAgo: number, baseDate: Date = new Date()) {
  return getUtcDateKey(
    new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - monthsAgo, 1))
  );
}

export function getUtcYearStartKey(yearsAgo: number, baseDate: Date = new Date()) {
  return getUtcDateKey(new Date(Date.UTC(baseDate.getUTCFullYear() - yearsAgo, 0, 1)));
}

export function diffUtcDateKeys(a: string, b: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((parseUtcDateKey(b).getTime() - parseUtcDateKey(a).getTime()) / msPerDay);
}
