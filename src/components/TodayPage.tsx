import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  EMPTY_DAY,
  habitKey,
  taskKey,
  type DayState,
} from "../../convex/supportModel";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { useSaveAction } from "../hooks/useSaveAction";
import { usePrayerTimes } from "../hooks/usePrayerTimes";
import { getScheduledAthkarWindow } from "../lib/athkarSchedule";
import { PageHeader } from "./PageHeader";
import { TemplateGallery } from "./TemplateGallery";
import { DayAdjustment, type TodayItem } from "./DayAdjustment";
import { TodayWorkout } from "./TodayWorkout";

type Destination = "routines" | "habits" | "workout" | "progress" | "athkar";
type Props = { onNavigate: (page: Destination) => void; displayName: string };
const card = "rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6";
const quiet =
  "min-h-11 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white disabled:opacity-40";
export function TodayPage(props: Props) {
  const dateKey = useLocalDateKey();
  return <TodayContent key={dateKey} dateKey={dateKey} {...props} />;
}
function TodayContent({ dateKey, onNavigate }: Props & { dateKey: string }) {
  const preferences = useQuery(api.workspace.getPreferences);
  const routines = useQuery(api.routines.getRoutines);
  const habits = useQuery(api.habits.getHabits);
  const days = useQuery(api.workouts.getWorkoutDays);
  const routineDay = useQuery(api.routines.getTodayProgress, { dateKey });
  const support = useQuery(api.daySupport.getToday, { dateKey });
  const athkar = useQuery(api.athkar.getAthkar);
  const ensureDefaultAthkar = useMutation(api.athkar.ensureDefaultAthkar);
  const prepareCategorySession = useMutation(api.athkar.prepareCategorySession);
  const toggleTask = useMutation(api.routines.toggleTask);
  const logHabit = useMutation(api.habits.logHabit);
  const saveDay = useMutation(api.daySupport.saveDay);
  const visit = useMutation(api.daySupport.visitToday);
  const completeDay = useMutation(api.routines.completeDay);
  const ensureStats = useMutation(api.routines.ensureUserStats);
  const athkarEnabled = Boolean(preferences && !preferences.hiddenPages.includes("athkar"));
  const prayerClock = usePrayerTimes(athkarEnabled);
  const scheduledAthkar = useMemo(() => getScheduledAthkarWindow(prayerClock.now), [prayerClock.now]);
  const categorySession = useQuery(
    api.athkar.getCategorySession,
    athkarEnabled && scheduledAthkar ? { category: scheduledAthkar.category } : "skip",
  );
  const prayerSession = useQuery(
    api.athkar.getPrayerSession,
    athkarEnabled && prayerClock.activePrayer ? { sessionKey: prayerClock.activePrayer.sessionKey } : "skip",
  );
  const action = useSaveAction();
  const [editing, setEditing] = useState<{
    state: DayState;
    version: number;
  } | null>(null);
  const [undo, setUndo] = useState<{ state: DayState; version: number } | null>(
    null,
  );
  const [workoutOpen, setWorkoutOpen] = useState(false);
  useEffect(() => {
    void visit({ dateKey }).catch(() => {});
  }, [dateKey, visit]);
  useEffect(() => {
    if (!athkarEnabled) return;
    void ensureDefaultAthkar().catch(() => {});
  }, [athkarEnabled, ensureDefaultAthkar]);

  useEffect(() => {
    if (!athkarEnabled || !scheduledAthkar) return;
    void prepareCategorySession({
      category: scheduledAthkar.category,
      windowKey: scheduledAthkar.windowKey,
    }).catch(() => {});
  }, [athkarEnabled, scheduledAthkar?.category, scheduledAthkar?.windowKey, prepareCategorySession]);
  if (
    !routines ||
    !habits ||
    !days ||
    routineDay === undefined ||
    preferences === undefined ||
    support === undefined ||
    (athkarEnabled && athkar === undefined)
  )
    return (
      <p role="status" className="p-10 text-center text-white/60">
        Getting your day ready…
      </p>
    );
  const visible = (page: Destination) =>
    !preferences?.hiddenPages.includes(page);
  const tasks = (visible("routines") ? routines : []).flatMap((routine) =>
    [...routine.tasks]
      .sort((a, b) => a.order - b.order)
      .map((task) => ({
        ...task,
        routineId: routine._id,
        group: routine.name,
        key: taskKey(routine._id, task.id),
      })),
  );
  const activeHabits = visible("habits")
    ? habits.filter((habit) => habit.isActive !== false)
    : [];
  const items: TodayItem[] = [
    ...tasks.map((task) => ({
      key: task.key,
      name: task.name,
      group: task.group,
      completed: task.completed,
      locked: routineDay?.countedInStats === true,
    })),
    ...activeHabits.map((habit) => ({
      key: habitKey(habit._id),
      name: habit.name,
      group: habit.type === "break" ? "Avoided today" : "Habit",
      completed: habit.entries.some(
        (entry) => entry.date === dateKey && entry.completed,
      ),
    })),
  ];
  const state = support?.state ?? EMPTY_DAY;
  const version = support?.version ?? 0;
  const adjustment = (key: string) =>
    state.adjustments.find((row) => row.key === key);
  const isDone = (item: TodayItem) =>
    item.completed ||
    (adjustment(item.key)?.mode === "step" && adjustment(item.key)?.stepDone);
  const completed = items.filter(isDone);
  const paused = items.filter(
    (item) => !isDone(item) && adjustment(item.key)?.mode === "pause",
  );
  const remaining = items.filter(
    (item) => !isDone(item) && !paused.includes(item),
  );
  const hasWorkout =
    visible("workout") && days.some((day) => day.exercises.length > 0);
  const athkarRows = athkar ?? [];
  const scheduledItems = scheduledAthkar
    ? athkarRows.filter((row) => row.category === scheduledAthkar.category)
    : [];
  const scheduledTotal = scheduledItems.reduce((sum, row) => sum + Math.max(1, row.targetCount), 0);
  const scheduledCurrent = scheduledItems.reduce((sum, row) => sum + Math.min(row.currentCount, Math.max(1, row.targetCount)), 0);
  const scheduledCompletedThisWindow = Boolean(
    scheduledAthkar &&
    categorySession?.completed &&
    categorySession.completedWindowKey === scheduledAthkar.windowKey,
  );
  const scheduledNeedsFreshReset = Boolean(
    scheduledAthkar &&
    categorySession?.completed &&
    categorySession.completedWindowKey &&
    categorySession.completedWindowKey !== scheduledAthkar.windowKey,
  );
  const scheduledPercent = scheduledCompletedThisWindow
    ? 100
    : scheduledNeedsFreshReset
      ? 0
      : scheduledTotal
        ? Math.round((scheduledCurrent / scheduledTotal) * 100)
        : 0;

  const prayerItems = athkarRows.filter((row) => row.category === "prayer");
  const prayerCounts = new Map((prayerSession?.counts ?? []).map((row) => [String(row.dhikrId), row.count]));
  const prayerTotal = prayerItems.reduce((sum, row) => sum + Math.max(1, row.targetCount), 0);
  const prayerCurrent = prayerItems.reduce((sum, row) => sum + Math.min(prayerCounts.get(String(row._id)) ?? 0, Math.max(1, row.targetCount)), 0);
  const prayerPercent = prayerSession?.completed ? 100 : prayerTotal ? Math.round((prayerCurrent / prayerTotal) * 100) : 0;
  const hasAthkarToday = athkarEnabled && Boolean(scheduledAthkar || prayerClock.activePrayer);

  const openAthkar = (category: string, prayerSessionKey?: string) => {
    try {
      sessionStorage.setItem("ceventic_athkar_open_category", category);
      if (prayerSessionKey) sessionStorage.setItem("ceventic_athkar_prayer_session", prayerSessionKey);
      else sessionStorage.removeItem("ceventic_athkar_prayer_session");
    } catch {}
    onNavigate("athkar");
  };
  const persist = async (
    next: DayState,
    baseline = { state, version },
    allowUndo = false,
  ) => {
    const savedVersion = await saveDay({
      dateKey,
      expectedVersion: baseline.version,
      state: { ...next, focusKey: "", startedKey: "" },
    });
    setUndo(
      allowUndo ? { state: baseline.state, version: savedVersion } : null,
    );
  };
  const toggle = (item: TodayItem) =>
    void action.run(async () => {
      const row = adjustment(item.key);
      if (row?.mode === "step" && !item.completed) {
        await persist({
          ...state,
          adjustments: state.adjustments.map((value) =>
            value.key === item.key
              ? { ...value, stepDone: !value.stepDone }
              : value,
          ),
        });
      } else {
        const task = tasks.find((value) => value.key === item.key);
        if (task)
          await toggleTask({
            routineId: task.routineId,
            taskId: task.id,
            dateKey,
          });
        else {
          const habit = activeHabits.find(
            (value) => habitKey(value._id) === item.key,
          );
          if (habit)
            await logHabit({
              habitId: habit._id,
              completed: !item.completed,
              dateKey,
            });
        }
        setUndo(null);
      }
    });
  const renderItem = (item: TodayItem) => {
    const row = adjustment(item.key);
    const small = row?.mode === "step" && !item.completed;
    return (
      <label
        key={item.key}
        className="flex min-h-16 items-center gap-4 border-b border-white/5 py-4 last:border-0"
      >
        <input
          type="checkbox"
          checked={Boolean(isDone(item))}
          disabled={action.busy || item.locked || Boolean(editing)}
          onChange={() => toggle(item)}
          className="h-5 w-5 shrink-0 accent-[rgb(var(--sw-accent-rgb))]"
        />
        <span className="min-w-0">
          <span
            className={
              "block break-words " +
              (isDone(item) ? "text-white/50 line-through" : "text-white")
            }
          >
            {small ? row.step : item.name}
          </span>
          <span className="mt-1 block text-xs text-white/45">
            {small
              ? `Smaller step for ${item.name} · full action unfinished`
              : item.group}
            {item.locked && !isDone(item)
              ? " · Day saved; action unfinished"
              : ""}
          </span>
        </span>
      </label>
    );
  };
  const dateLabel = new Date(dateKey + "T12:00:00").toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" },
  );
  return (
    <div className="mx-auto max-w-3xl space-y-5" data-no-swipe>
      <PageHeader title="Today" subtitle={dateLabel} />
      {hasAthkarToday && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Athkar</h2>
              <p className="mt-1 text-xs text-white/45">What is relevant right now.</p>
            </div>
            <button className={quiet} onClick={() => onNavigate("athkar")}>Open all</button>
          </div>
          <div className="mt-3 grid gap-3">
            {scheduledAthkar && (
              <button
                onClick={() => openAthkar(scheduledAthkar.category)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{scheduledAthkar.title}</div>
                    <div className="mt-1 text-xs text-white/45">{scheduledAthkar.startsAt}–{scheduledAthkar.endsAt}</div>
                  </div>
                  <span className="text-sm font-semibold text-white/70">{scheduledCompletedThisWindow ? "Completed" : `${scheduledPercent}%`}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, scheduledPercent))}%` }} />
                </div>
                <div className="mt-3 text-xs text-white/45">
                  {scheduledCompletedThisWindow
                    ? "Finished for this time window."
                    : categorySession?.currentIndex
                      ? `Resume at item ${categorySession.currentIndex + 1}.`
                      : "Continue from exactly where you stopped."}
                </div>
              </button>
            )}

            {prayerClock.activePrayer && (
              <button
                onClick={() => openAthkar("prayer", prayerClock.activePrayer?.sessionKey)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">After {prayerClock.activePrayer.name} Prayer Athkar</div>
                    <div className="mt-1 text-xs text-white/45">Available for 1 hour after {prayerClock.activePrayer.time}</div>
                  </div>
                  <span className="text-sm font-semibold text-white/70">{prayerSession?.completed ? "Completed" : `${prayerPercent}%`}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, prayerPercent))}%` }} />
                </div>
                <div className="mt-3 text-xs text-white/45">
                  {prayerSession?.completed
                    ? "This prayer's Athkar is finished."
                    : prayerSession?.currentIndex
                      ? `Resume at item ${prayerSession.currentIndex + 1}.`
                      : "This prayer has its own saved session."}
                </div>
              </button>
            )}
          </div>
        </section>
      )}
      {!items.length && !hasWorkout && !hasAthkarToday ? (
        <TemplateGallery dateKey={dateKey} onDone={() => {}} />
      ) : (
        <>
          {items.length > 0 && (
            <section className={card}>
              <h2 className="text-lg font-semibold">Your day</h2>
              {remaining.length ? (
                <div className="mt-1">{remaining.map(renderItem)}</div>
              ) : (
                <p className="py-5 text-sm text-white/60">
                  Nothing else planned for today.
                </p>
              )}
              {completed.length > 0 && (
                <details className="border-t border-white/10 py-3">
                  <summary className="cursor-pointer py-2 text-sm text-white/50">
                    Done today ({completed.length})
                  </summary>
                  {completed.map(renderItem)}
                  {tasks.length > 0 &&
                    !routineDay?.countedInStats &&
                    tasks.filter((task) => task.completed).length /
                      tasks.length >=
                      0.8 && (
                      <div className="mt-3">
                        <button
                          disabled={action.busy || Boolean(editing)}
                          className={quiet}
                          onClick={() =>
                            void action.run(async () => {
                              await ensureStats({});
                              await completeDay({ dateKey });
                            })
                          }
                        >
                          Save routine day
                        </button>
                        <p className="text-xs text-white/45">
                          Counts this routine day toward your streak and locks
                          its checkmarks.
                        </p>
                      </div>
                    )}
                </details>
              )}
              {paused.length > 0 && (
                <details className="border-t border-white/10 py-3">
                  <summary className="cursor-pointer py-2 text-sm text-white/50">
                    Set aside today ({paused.length})
                  </summary>
                  {paused.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="min-w-0 break-words text-sm text-white/60">
                        {item.name}
                      </span>
                      <button
                        disabled={action.busy || Boolean(editing)}
                        className={quiet + " shrink-0"}
                        onClick={() =>
                          void action.run(() =>
                            persist({
                              ...state,
                              adjustments: state.adjustments.filter(
                                (row) => row.key !== item.key,
                              ),
                            }),
                          )
                        }
                      >
                        Bring back
                      </button>
                    </div>
                  ))}
                </details>
              )}
              {!editing &&
                items.some((item) => !isDone(item) && !item.locked) && (
                  <button
                    disabled={action.busy}
                    className={quiet + " mt-2"}
                    onClick={() => {
                      action.setError("");
                      setEditing({ state, version });
                    }}
                  >
                    Make today lighter
                  </button>
                )}
              {undo && undo.version === version && !editing && (
                <button
                  disabled={action.busy}
                  className={quiet}
                  onClick={() =>
                    void action.run(() =>
                      persist(undo.state, { state, version }),
                    )
                  }
                >
                  Undo lighter day
                </button>
              )}
            </section>
          )}
          {editing && (
            <DayAdjustment
              items={items.filter((item) => !isDone(item))}
              state={editing.state}
              busy={action.busy}
              error={action.error}
              onCancel={() => {
                setEditing(null);
                action.setError("");
              }}
              onApply={(next) =>
                void action.run(async () => {
                  await persist(next, editing, true);
                  setEditing(null);
                })
              }
            />
          )}
          {hasWorkout && (
            <details
              className={card}
              onToggle={(event) => setWorkoutOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer font-semibold">
                Workout
              </summary>
              {workoutOpen && (
                <div className="mt-4">
                  <TodayWorkout onOpen={() => onNavigate("workout")} />
                </div>
              )}
            </details>
          )}
        </>
      )}
      {action.error && !editing && (
        <p role="alert" className="text-sm text-red-300">
          {action.error}
        </p>
      )}
    </div>
  );
}
