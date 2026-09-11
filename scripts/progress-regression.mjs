// No network, browser, credentials or real database. Node 22+ and installed dependencies required.
import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import * as auth from "@convex-dev/auth/server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function load(relative) {
  const filename = path.join(root, relative);
  const output = await build({ entryPoints: [filename], bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent" });
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  module.require = specifier => specifier === "@convex-dev/auth/server" ? auth : Module.prototype.require.call(module, specifier);
  module._compile(output.outputFiles[0].text, filename);
  return module.exports;
}
const math = await load("convex/progressMath.ts");
const workouts = await load("convex/workouts.ts");
const progress = await load("convex/progress.ts");
const workspace = await load("convex/workspace.ts");
const recovery = await load("convex/recovery.ts");
const routines = await load("convex/routines.ts");
const habits = await load("convex/habits.ts");
const account = await load("convex/account.ts");
const plans = await load("convex/planFormat.ts");
const today = new Date().toISOString().slice(0, 10);
const before = days => new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
const exercise = { id: "exercise-one", name: "Pull ups", sets: 3, reps: "8-12", isWarmup: false };
const source = { _id: "day-one", _creationTime: 1, userId: "user-one", isActive: true, name: "Pull", order: 1, exercises: [exercise], warmupNotes: "Keep this note" };

function fakeContext(seed = {}, userId = "user-one") {
  const tables = structuredClone(seed);
  let count = 100;
  const db = {
    normalizeId(table, id) { return tables[table]?.some(row => row._id === id) ? id : null; },
    async get(id) { return Object.values(tables).flat().find(row => row._id === id) ?? null; },
    async insert(table, value) {
      const row = { ...structuredClone(value), _id: `row-${++count}`, _creationTime: Date.now() };
      (tables[table] ??= []).push(row); return row._id;
    },
    async patch(id, value) { const row = await this.get(id); assert.ok(row); Object.assign(row, structuredClone(value)); },
    async delete(id) { for (const table of Object.keys(tables)) tables[table] = tables[table].filter(row => row._id !== id); },
    query(table) {
      let rows = [...(tables[table] ?? [])];
      const query = {
        filter(callback) {
          const expressions = { field: key => row => row[key], eq: (a, b) => row => (typeof a === "function" ? a(row) : a) === (typeof b === "function" ? b(row) : b) };
          rows = rows.filter(callback(expressions)); return query;
        },
        withIndex(_name, callback) {
          const index = {
            eq(key, value) { rows = rows.filter(row => row[key] === value); return index; },
            gte(key, value) { rows = rows.filter(row => row[key] >= value); return index; },
            lte(key, value) { rows = rows.filter(row => row[key] <= value); return index; },
          };
          callback(index); return query;
        },
        order(direction) { rows.sort((a, b) => (String(a.date ?? a._creationTime).localeCompare(String(b.date ?? b._creationTime))) * (direction === "desc" ? -1 : 1)); return query; },
        async take(n) { return rows.slice(0, n); },
        async collect() { return rows; },
        async first() { return rows[0] ?? null; },
        async unique() { assert.ok(rows.length <= 1); return rows[0] ?? null; },
      }; return query;
    },
  };
  return { db, tables, auth: { async getUserIdentity() { return userId ? { subject: userId } : null; } } };
}

test("unknown days stay distinct from zero", () => {
  assert.equal(math.percentage(0, 0), null);
  assert.equal(math.meanRecorded([null, null]), null);
  assert.equal(math.meanRecorded([0, 100, null]), 50);
  assert.equal(math.percentage(4, 2), 100);
});
test("calendar includes gaps, leap days and year boundaries", () => {
  assert.deepEqual(math.dateRange("2024-02-28", "2024-03-01"), ["2024-02-28", "2024-02-29", "2024-03-01"]);
  assert.equal(math.dateRange("2025-12-30", "2026-01-02").length, 4);
});
test("partial buckets retain their actual denominator", () => {
  const data = [{ date: "2026-09-06", routines: 100 }, { date: "2026-09-07", routines: 0 }, { date: "2026-09-08", routines: null }];
  const buckets = math.aggregateProgress(data, "routines", "week");
  assert.deepEqual(buckets.map(row => [row.value, row.recorded, row.days]), [[100, 1, 1], [0, 1, 2]]);
});
test("best-set comparisons use like-for-like values", () => {
  const result = { exerciseId: "x", name: "Test" };
  assert.equal(math.compareResults({ ...result, holdSeconds: 5 }, { ...result, holdSeconds: 3 }), "+2s hold vs last time");
  assert.equal(math.compareResults({ ...result, reps: 8, weightKg: 10 }, { ...result, reps: 6, weightKg: 10 }), "+2 reps at the same load");
  assert.equal(math.compareResults({ ...result, reps: 8, weightKg: 12 }, { ...result, reps: 8, weightKg: 10 }), "+2 kg at the same reps");
  assert.equal(math.compareResults({ ...result, reps: 8, weightKg: 12 }, { ...result, reps: 6, weightKg: 10 }), null);
  assert.equal(math.compareResults({ ...result, reps: 8 }, { ...result, exerciseId: "other", reps: 6 }), null);
});
test("copy day keeps source and history; generates new exercise IDs", async () => {
  const ctx = fakeContext({ workoutDays: [source], workoutProgress: [{ _id: "history", userId: "user-one", date: before(1) }] });
  const id = await workouts.copyWorkoutDay._handler(ctx, { dayId: source._id, name: "Pull B" });
  const copy = await ctx.db.get(id);
  assert.equal(copy.name, "Pull B"); assert.equal(copy.order, 2);
  assert.notEqual(copy.exercises[0].id, exercise.id);
  assert.equal(copy.exercises[0].completed, false);
  assert.deepEqual(await ctx.db.get(source._id), source);
  assert.equal(ctx.tables.workoutProgress.length, 1);
});
test("copy respects ownership and day quotas", async () => {
  await assert.rejects(workouts.copyWorkoutDay._handler(fakeContext({ workoutDays: [source] }, "other"), { dayId: source._id, name: "Copy" }), /not found/);
  const days = Array.from({ length: 14 }, (_, index) => ({ ...source, _id: index ? `day-${index}` : source._id }));
  await assert.rejects(workouts.copyWorkoutDay._handler(fakeContext({ workoutDays: days }), { dayId: source._id, name: "Copy" }), /limit/);
});
test("split application preserves custom days, exercises and notes", async () => {
  const days = Array.from({ length: 9 }, (_, index) => ({ ...source, _id: `day-${index}`, order: index + 1 }));
  const ctx = fakeContext({ workoutDays: days });
  await workouts.applyWorkoutSplit._handler(ctx, { names: ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"] });
  assert.equal(ctx.tables.workoutDays.length, 9);
  assert.equal(ctx.tables.workoutDays[8].name, "Pull");
  assert.deepEqual(ctx.tables.workoutDays[0].exercises, source.exercises);
  assert.equal(ctx.tables.workoutDays[0].warmupNotes, source.warmupNotes);
});
test("logging upserts today's result without checking exercises or deleting history", async () => {
  const previous = { _id: "old", userId: "user-one", date: before(1), workoutDayId: source._id, exerciseResults: [{ exerciseId: exercise.id, name: exercise.name, reps: 4 }] };
  const ctx = fakeContext({ workoutDays: [source], workoutProgress: [previous] });
  const args = { dayId: source._id, exerciseId: exercise.id, dateKey: today, reps: 5 };
  await workouts.logExerciseResult._handler(ctx, args);
  await workouts.logExerciseResult._handler(ctx, { ...args, reps: 7 });
  const current = ctx.tables.workoutProgress.find(row => row.date === today);
  assert.equal(ctx.tables.workoutProgress.length, 2);
  assert.equal(current.exerciseResults.length, 1);
  assert.equal(current.exerciseResults[0].reps, 7);
  assert.deepEqual(current.completedExercises, []);
  assert.equal(current.completedWorkout, false);
  assert.deepEqual(await ctx.db.get("old"), previous);
});
test("result logging rejects unauthorized and malformed input", async () => {
  const args = { dayId: source._id, exerciseId: exercise.id, dateKey: today };
  const ctx = fakeContext({ workoutDays: [source] });
  for (const input of [{}, { reps: 1.5 }, { reps: -1 }, { holdSeconds: Infinity }, { holdSeconds: 3, reps: 5 }, { reps: 5, weightKg: -10 }]) {
    await assert.rejects(workouts.logExerciseResult._handler(ctx, { ...args, ...input }));
  }
  await assert.rejects(workouts.logExerciseResult._handler(fakeContext({ workoutDays: [source] }, null), { ...args, reps: 5 }), /authenticated/);
  await assert.rejects(workouts.logExerciseResult._handler(fakeContext({ workoutDays: [source] }, "other"), { ...args, reps: 5 }), /not found/);
  assert.equal(ctx.tables.workoutProgress, undefined);
});
test("result query is account scoped and bounded to recent history", async () => {
  const make = (id, userId, date) => ({ _id: id, userId, date, dayLabel: "Pull", workoutDayId: source._id, exerciseResults: [{ exerciseId: exercise.id, name: exercise.name, reps: 5 }] });
  const ctx = fakeContext({ workoutProgress: [make("one", "user-one", today), make("two", "other", today), make("three", "user-one", before(91))] });
  assert.equal((await workouts.getExerciseResults._handler(ctx, { dateKey: today })).length, 1);
  assert.deepEqual(await workouts.getExerciseResults._handler(fakeContext({}, null), { dateKey: today }), []);
});
test("progress includes missing days and all eligible habits in the denominator", async () => {
  const ctx = fakeContext({
    habits: [
      { _id: "habit-a", _creationTime: Date.parse(before(20)), userId: "user-one", entries: [{ date: today, completed: true }] },
      { _id: "habit-b", _creationTime: Date.parse(before(20)), userId: "user-one", entries: [] },
      { _id: "habit-other", _creationTime: 1, userId: "other", entries: [{ date: today, completed: true }] },
    ],
    workoutProgress: [{ _id: "workout", userId: "user-one", date: before(1), completedExercises: ["a"], totalExercises: 2, completedWorkout: false }],
  });
  const rows = await progress.getProgressData._handler(ctx, { dateKey: today, timeFrame: "daily" });
  assert.equal(rows.length, 7);
  assert.equal(rows.at(-1).habits, 50);
  assert.equal(rows.at(-1).workouts, null);
  assert.equal(rows.at(-2).workouts, 50);
  assert.equal(rows[0].routines, null);
});
test("workout completion excludes hidden warmups and stale exercise IDs", async () => {
  const day = { ...source, exercises: [exercise, { ...exercise, id: "warmup", isWarmup: true }] };
  const ctx = fakeContext({ workoutDays: [day], workoutProgress: [{ _id: "p", userId: "user-one", date: today, workoutDayId: day._id, completedExercises: ["deleted"], totalExercises: 2, completionRate: 50, completedWorkout: false }] });
  const result = await workouts.toggleExerciseComplete._handler(ctx, { dayId: day._id, exerciseId: exercise.id, dateKey: today });
  assert.equal(result.completionRate, 100);
  assert.deepEqual((await ctx.db.get("p")).completedExercises, [exercise.id]);
  await assert.rejects(workouts.toggleExerciseComplete._handler(ctx, { dayId: day._id, exerciseId: "warmup", dateKey: today }), /Warmups/);
});
test("finishing an already-saved workout preserves its original snapshot", async () => {
  const saved = { _id: "p", userId: "user-one", date: today, workoutDayId: source._id, completedExercises: ["old"], totalExercises: 10, completionRate: 70, completedWorkout: true };
  const ctx = fakeContext({ workoutDays: [source], workoutProgress: [saved] });
  assert.deepEqual(await workouts.completeWorkout._handler(ctx, { dayId: source._id, dateKey: today }), { completionRate: 70 });
  assert.deepEqual(await ctx.db.get("p"), saved);
});

const samplePlan = { version: 1, routines: [{ name: "Morning", timeSlot: "Any time", tasks: ["Plan one priority"] }], workouts: [{ name: "Pull", exercises: [{ name: "Pull up", sets: 3, reps: "5", notes: "Keep this", isWarmup: false }] }] };
test("plan validation strips IDs and checkmarks; rejects malformed and excessive files", () => {
  const input = structuredClone(samplePlan);
  input.userId = "other"; input.routines[0].tasks = ["<script>text only</script>"];
  input.workouts[0].exercises[0].id = "bad"; input.workouts[0].exercises[0].completed = true;
  const clean = plans.validatePlan(input);
  assert.equal(clean.userId, undefined); assert.equal(clean.workouts[0].exercises[0].id, undefined);
  assert.equal(clean.workouts[0].exercises[0].completed, undefined);
  for (const invalid of [{}, { ...samplePlan, version: 2 }, { ...samplePlan, routines: "bad" }, { ...samplePlan, workouts: [{ name: "Bad", exercises: [{ name: "Bad", sets: 10000, reps: "5" }] }] }, { ...samplePlan, ignored: "x".repeat(500001) }]) assert.throws(() => plans.validatePlan(invalid));
});
test("imports append atomically-shaped plans and retries do not duplicate them", async () => {
  const ctx = fakeContext({ workoutDays: [source] });
  const args = { plan: samplePlan, requestId: "request-one" };
  assert.deepEqual(await workspace.importPlan._handler(ctx, args), { routines: 1, workouts: 1 });
  await workspace.importPlan._handler(ctx, args);
  assert.equal(ctx.tables.routines.length, 1); assert.equal(ctx.tables.workoutDays.length, 2);
  assert.deepEqual(await ctx.db.get(source._id), source);
  assert.equal(ctx.tables.routines[0].tasks[0].completed, false);
  assert.equal(ctx.tables.planApplications.length, 1);
});
test("import quota and validation failures occur before any plan is written", async () => {
  const ctx = fakeContext({ workoutDays: Array.from({ length: 14 }, (_, i) => ({ ...source, _id: `day${i}` })) });
  await assert.rejects(workspace.importPlan._handler(ctx, { plan: samplePlan, requestId: "full" }), /Nothing was imported/);
  assert.equal(ctx.tables.routines, undefined); assert.equal(ctx.tables.planApplications, undefined);
});
test("setup is optional, non-destructive and idempotent", async () => {
  const ctx = fakeContext({ workoutDays: [source] });
  await workspace.finishSetup._handler(ctx, { focus: "daily", useStarter: true });
  await workspace.finishSetup._handler(ctx, { focus: "daily", useStarter: true });
  assert.equal(ctx.tables.routines.length, 1);
  assert.deepEqual(await ctx.db.get(source._id), source);
  const blank = fakeContext();
  await workspace.finishSetup._handler(blank, { focus: "training", useStarter: false });
  assert.equal(blank.tables.routines, undefined); assert.equal(blank.tables.workspacePreferences[0].setupDone, true);
});
test("workspace preferences enforce a visible starting page and leave plans alone", async () => {
  const ctx = fakeContext({ workoutDays: [source] });
  await assert.rejects(workspace.savePreferences._handler(ctx, { hiddenPages: ["workout"], startPage: "workout", quiet: false }), /visible/);
  await assert.rejects(workspace.savePreferences._handler(ctx, { hiddenPages: ["today"], startPage: "today", quiet: false }), /available/);
  await workspace.savePreferences._handler(ctx, { hiddenPages: ["athkar", "macros"], startPage: "workout", quiet: true });
  const saved = await workspace.getPreferences._handler(ctx, {});
  assert.equal(saved.startPage, "workout"); assert.equal(saved.quiet, true);
  assert.deepEqual(await ctx.db.get(source._id), source);
  assert.equal(await workspace.getPreferences._handler(fakeContext({}, null), {}), null);
});
test("saved templates are reusable snapshots scoped to the account", async () => {
  const ctx = fakeContext();
  const id = await workspace.saveTemplate._handler(ctx, { name: "My plan", plan: samplePlan });
  const listed = await workspace.listTemplates._handler(ctx, {});
  assert.equal(listed.length, 1);
  await workspace.importPlan._handler(ctx, { plan: listed[0].plan, requestId: "template-use" });
  assert.equal(ctx.tables.planTemplates.length, 1);
  const other = fakeContext(ctx.tables, "other");
  assert.deepEqual(await workspace.listTemplates._handler(other, {}), []);
  await assert.rejects(workspace.deleteTemplate._handler(other, { id }), /not found/);
});
test("export omits account IDs, deleted items and completion flags", async () => {
  const ctx = fakeContext({ workoutDays: [source, { ...source, _id: "removed", isActive: false, deletedAt: Date.now() }], routines: [{ _id: "routine", userId: "user-one", isActive: true, name: "Daily", timeSlot: "AM", tasks: [{ id: "task", name: "Hello", order: 0, completed: true }] }] });
  const exported = await workspace.getCurrentPlan._handler(ctx, {});
  assert.equal(exported.workouts.length, 1);
  assert.deepEqual(exported.routines[0].tasks, ["Hello"]);
  assert.equal(exported.workouts[0].exercises[0].id, undefined);
  assert.deepEqual(plans.validatePlan(exported).routines, exported.routines);
});
test("workout and rest choices persist by date without changing session logs", async () => {
  const ctx = fakeContext({ workoutDays: [source], workoutProgress: [{ _id: "progress", userId: "user-one", date: today, completedExercises: [exercise.id] }] });
  await workspace.chooseTodayWorkout._handler(ctx, { dateKey: today, rest: false, dayId: source._id });
  await workspace.chooseTodayWorkout._handler(ctx, { dateKey: today, rest: true });
  assert.equal(ctx.tables.todayPlans.length, 1);
  assert.equal((await workspace.getTodayPlan._handler(ctx, { dateKey: today })).rest, true);
  assert.deepEqual(ctx.tables.workoutProgress[0].completedExercises, [exercise.id]);
  await assert.rejects(workspace.chooseTodayWorkout._handler(fakeContext({ workoutDays: [source] }, "other"), { dateKey: today, rest: false, dayId: source._id }), /not found/);
});
test("deleting and restoring a workout preserves its ID and history", async () => {
  const ctx = fakeContext({ workoutDays: [source], workoutProgress: [{ _id: "p", userId: "user-one", workoutDayId: source._id, date: before(1), completedExercises: [exercise.id] }] });
  await workouts.deleteWorkoutDay._handler(ctx, { dayId: source._id });
  assert.equal((await ctx.db.get(source._id)).isActive, false);
  assert.deepEqual(await workouts.getWorkoutDays._handler(ctx, {}), []);
  const entry = ctx.tables.recycleBin[0];
  await recovery.restore._handler(ctx, { id: entry._id });
  assert.equal((await ctx.db.get(source._id)).isActive, true);
  assert.equal(ctx.tables.workoutProgress[0].workoutDayId, source._id);
  assert.equal(ctx.tables.recycleBin.length, 0);
});
test("task and exercise restoration respects parent state and original IDs", async () => {
  const routine = { _id: "routine", userId: "user-one", name: "Daily", timeSlot: "Any", isActive: true, tasks: [{ id: "task", name: "Plan", order: 0, completed: true }] };
  const ctx = fakeContext({ routines: [routine], workoutDays: [source] });
  await routines.deleteTask._handler(ctx, { routineId: routine._id, taskId: "task" });
  await routines.deleteRoutine._handler(ctx, { routineId: routine._id });
  const taskEntry = ctx.tables.recycleBin.find(row => row.kind === "task");
  await assert.rejects(recovery.restore._handler(ctx, { id: taskEntry._id }), /parent routine first/);
  await recovery.restore._handler(ctx, { id: ctx.tables.recycleBin.find(row => row.kind === "routine")._id });
  await recovery.restore._handler(ctx, { id: taskEntry._id });
  assert.equal((await ctx.db.get(routine._id)).tasks[0].id, "task");
  assert.equal((await ctx.db.get(routine._id)).tasks[0].completed, false);
  await workouts.deleteExercise._handler(ctx, { dayId: source._id, exerciseId: exercise.id });
  await recovery.restore._handler(ctx, { id: ctx.tables.recycleBin[0]._id });
  assert.equal((await ctx.db.get(source._id)).exercises[0].id, exercise.id);
});
test("habit recovery preserves entries while deleted habits leave active queries", async () => {
  const habit = { _id: "h", _creationTime: 1, userId: "user-one", isActive: true, name: "Read", type: "build", entries: [{ date: today, completed: true }], longestStreak: 5, currentStreak: 1 };
  const ctx = fakeContext({ habits: [habit] });
  await habits.deleteHabit._handler(ctx, { habitId: habit._id });
  assert.deepEqual(await habits.getHabits._handler(ctx, {}), []);
  await recovery.restore._handler(ctx, { id: ctx.tables.recycleBin[0]._id });
  assert.deepEqual((await habits.getHabits._handler(ctx, {}))[0].entries, habit.entries);
});
test("a full recycle bin prevents deletion; foreign restores and purges are rejected", async () => {
  const full = fakeContext({ workoutDays: [source], recycleBin: Array.from({ length: 100 }, (_, i) => ({ _id: `bin${i}`, userId: "user-one", kind: "task", itemId: `task${i}` })) });
  await assert.rejects(workouts.deleteWorkoutDay._handler(full, { dayId: source._id }), /full/);
  assert.equal((await full.db.get(source._id)).isActive, true);
  const ctx = fakeContext({ recycleBin: [{ _id: "bin", userId: "other", kind: "task", itemId: "task" }] });
  await assert.rejects(recovery.restore._handler(ctx, { id: "bin" }), /not found/);
  await assert.rejects(recovery.removePermanently._handler(ctx, { id: "bin", confirm: "DELETE" }), /not found/);
});
test("account deletion removes new account-owned tables, but no other account data", async () => {
  const seed = { users: [{ _id: "user-one" }] };
  for (const table of ["workspacePreferences", "planTemplates", "planApplications", "todayPlans", "recycleBin"]) seed[table] = [{ _id: `${table}one`, userId: "user-one" }, { _id: `${table}other`, userId: "other" }];
  const ctx = fakeContext(seed);
  await account.deleteMyAccount._handler(ctx, { confirmation: "DELETE" });
  for (const table of Object.keys(seed).filter(key => key !== "users")) assert.deepEqual(ctx.tables[table], [{ _id: `${table}other`, userId: "other" }]);
});
test("weekly comparisons use equal full windows and omit today's partial data", () => {
  const days = Array.from({ length: 28 }, (_, i) => ({ date: before(27 - i), routines: i === 27 ? 0 : 100, habits: null, workouts: null, tasksDone: i === 27 ? 999 : 2, habitsDone: 0, exercisesDone: 0, workoutsCompleted: 0 }));
  const compared = math.compareCompletedWeeks(days, "routines");
  assert.equal(compared.current.completions, 14); assert.equal(compared.previous.completions, 14);
  assert.equal(compared.current.end, before(1)); assert.equal(compared.previous.end, before(8));
  assert.equal(compared.current.recordedDays, 7); assert.equal(compared.delta, 0);
  assert.equal(math.compareCompletedWeeks(days, "habits").delta, null);
});
