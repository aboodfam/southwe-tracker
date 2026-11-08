import { keepAvailableFocus } from "../lib/homeOverview";
import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { normalizeHomeLayout, type HomeSection } from "../../convex/homeLayout";
import { HomeCustomization } from "./HomeCustomization";
import { HomeConsistency } from "./HomeConsistency";
import { ChoiceSelect } from "./ChoiceSelect";
import { Icon } from "./icons";
import { DayAdjustment, type TodayItem } from "./DayAdjustment";
import { TodayWorkout } from "./TodayWorkout";

type Destination = "routines" | "habits" | "workout" | "progress" | "athkar";
type Props = { onNavigate: (page: Destination) => void; displayName: string };
const card = "rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5";
const quiet =
  "min-h-11 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white disabled:opacity-40";
export function HomePage(props: Props) {
  useLocale();
  const dateKey = useLocalDateKey();
  return <HomeContent key={dateKey} dateKey={dateKey} {...props} />;
}
function HomeContent({
  dateKey,
  onNavigate,
  displayName,
}: Props & { dateKey: string }) {
  useLocale();
  const preferences = useQuery(api.workspace.getPreferences);
  const routines = useQuery(api.routines.getRoutines);
  const habits = useQuery(api.habits.getHabits);
  const days = useQuery(api.workouts.getWorkoutDays);
  const routineDay = useQuery(api.routines.getTodayProgress, { dateKey });
  const support = useQuery(api.daySupport.getToday, { dateKey });
  const athkarEnabled = Boolean(
    preferences &&
    !preferences.hiddenPages.includes("athkar") &&
    !preferences.homeHidden.includes("athkar"),
  );
  const athkar = useQuery(api.athkar.getAthkar, athkarEnabled ? {} : "skip");
  const ensureDefaultAthkar = useMutation(api.athkar.ensureDefaultAthkar);
  const prepareCategorySession = useMutation(api.athkar.prepareCategorySession);
  const toggleTask = useMutation(api.routines.toggleTask);
  const logHabit = useMutation(api.habits.logHabit);
  const saveDay = useMutation(api.daySupport.saveDay);
  const visit = useMutation(api.daySupport.visitToday);
  const completeDay = useMutation(api.routines.completeDay);
  const ensureStats = useMutation(api.routines.ensureUserStats);
  const prayerClock = usePrayerTimes(athkarEnabled);
  const scheduledAthkar = useMemo(
    () => getScheduledAthkarWindow(prayerClock.now),
    [prayerClock.now],
  );
  const categorySession = useQuery(
    api.athkar.getCategorySession,
    athkarEnabled && scheduledAthkar
      ? { category: scheduledAthkar.category }
      : "skip",
  );
  const prayerSession = useQuery(
    api.athkar.getPrayerSession,
    athkarEnabled && prayerClock.activePrayer
      ? { sessionKey: prayerClock.activePrayer.sessionKey }
      : "skip",
  );
  const action = useSaveAction();
  const [editing, setEditing] = useState<{
    state: DayState;
    version: number;
  } | null>(null);
  const [undo, setUndo] = useState<{ state: DayState; version: number } | null>(
    null,
  );
  const [customizing, setCustomizing] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [choosingFocus, setChoosingFocus] = useState(false);
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
  }, [
    athkarEnabled,
    scheduledAthkar?.category,
    scheduledAthkar?.windowKey,
    prepareCategorySession,
  ]);
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
        {tr("Getting your day ready…")}{" "}
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
      group: habit.type === "break" ? tr("Avoided today") : tr("Habit"),
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
  const athkarRows = athkar ?? [];
  const scheduledItems = scheduledAthkar
    ? athkarRows.filter((row) => row.category === scheduledAthkar.category)
    : [];
  const scheduledTotal = scheduledItems.reduce(
    (sum, row) => sum + Math.max(1, row.targetCount),
    0,
  );
  const scheduledCurrent = scheduledItems.reduce(
    (sum, row) =>
      sum + Math.min(row.currentCount, Math.max(1, row.targetCount)),
    0,
  );
  const scheduledCompletedThisWindow = Boolean(
    scheduledAthkar &&
    categorySession?.completed &&
    categorySession.completedWindowKey === scheduledAthkar.windowKey,
  );
  const scheduledNeedsFreshReset = Boolean(
    scheduledAthkar &&
    categorySession?.activeWindowKey !== scheduledAthkar.windowKey,
  );
  const scheduledPercent = scheduledCompletedThisWindow
    ? 100
    : scheduledNeedsFreshReset
      ? 0
      : scheduledTotal
        ? Math.round((scheduledCurrent / scheduledTotal) * 100)
        : 0;

  const prayerItems = athkarRows.filter((row) => row.category === "prayer");
  const prayerCounts = new Map(
    (prayerSession?.counts ?? []).map((row) => [
      String(row.dhikrId),
      row.count,
    ]),
  );
  const prayerTotal = prayerItems.reduce(
    (sum, row) => sum + Math.max(1, row.targetCount),
    0,
  );
  const prayerCurrent = prayerItems.reduce(
    (sum, row) =>
      sum +
      Math.min(
        prayerCounts.get(String(row._id)) ?? 0,
        Math.max(1, row.targetCount),
      ),
    0,
  );
  const prayerPercent = prayerSession?.completed
    ? 100
    : prayerTotal
      ? Math.round((prayerCurrent / prayerTotal) * 100)
      : 0;
  const hasAthkarToday =
    athkarEnabled && Boolean(scheduledAthkar || prayerClock.activePrayer);

  const openAthkar = (category: string, prayerSessionKey?: string) => {
    try {
      sessionStorage.setItem("ceventic_athkar_open_category", category);
      if (prayerSessionKey)
        sessionStorage.setItem(
          "ceventic_athkar_prayer_session",
          prayerSessionKey,
        );
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
      state: keepAvailableFocus(
        next,
        items.map((item) => item.key),
      ),
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
        className="flex min-h-14 items-center gap-3 border-b border-white/5 py-3 last:border-0"
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
              ? tr("Smaller step for {0} · full action unfinished", {
                  0: item.name,
                })
              : item.group}
            {item.locked && !isDone(item)
              ? tr(" · Day saved; action unfinished")
              : ""}
          </span>
        </span>
      </label>
    );
  };
  const dateLabel = new Date(dateKey + "T12:00:00").toLocaleDateString(
    getIntlLocale(),
    { weekday: "long", month: "long", day: "numeric" },
  );
  const home = normalizeHomeLayout(
    preferences?.homeOrder,
    preferences?.homeHidden,
  );
  const focusItems = remaining.filter((item) => !item.locked);
  const focus =
    focusItems.find((item) => item.key === state.focusKey) ?? focusItems[0];
  const sections: Record<HomeSection, ReactNode> = {
    focus: (
      <section aria-label={tr("Focus")} className={card + " border-primary/20"}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="habits" className="h-4 w-4 text-primary" />
            {tr("Focus")}
          </h2>
          {focus && (
            <button
              aria-expanded={choosingFocus}
              className={quiet}
              onClick={() => setChoosingFocus((value) => !value)}
            >
              {tr("Change focus")}
            </button>
          )}
        </div>
        {focus ? (
          <>
            {renderItem(focus)}
            {choosingFocus && (
              <ChoiceSelect
                label={tr("Choose your focus")}
                value={focus.key}
                disabled={action.busy || Boolean(editing)}
                options={focusItems.map((item) => ({
                  value: item.key,
                  label: item.name,
                }))}
                onChange={(key) =>
                  void action.run(async () => {
                    await persist({ ...state, focusKey: key, startedKey: "" });
                    setChoosingFocus(false);
                  })
                }
                className="mt-2 w-full"
              />
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-white/60">
            {items.length
              ? tr("Nothing else planned for today.")
              : tr("Add tasks or habits to choose a focus.")}
          </p>
        )}
      </section>
    ),
    tasks: (
      <>
        {items.length > 0 && (
          <section aria-label={tr("Tasks & habits")} className={card}>
            <h2 className="text-base font-semibold">{tr("Tasks & habits")}</h2>
            {remaining.length ? (
              <div className="mt-1">
                {remaining
                  .slice(0, tasksExpanded ? remaining.length : 3)
                  .map(renderItem)}
                {remaining.length > 3 && (
                  <button
                    className={quiet}
                    onClick={() => setTasksExpanded((value) => !value)}
                  >
                    {tasksExpanded
                      ? tr("Show less")
                      : tr("Show all {0}", { 0: remaining.length })}
                  </button>
                )}
              </div>
            ) : (
              <p className="py-5 text-sm text-white/60">
                {tr("Nothing else planned for today.")}{" "}
              </p>
            )}
            {completed.length > 0 && (
              <details className="border-t border-white/10 py-3">
                <summary className="cursor-pointer py-2 text-sm text-white/50">
                  {tr("Done today (")}
                  {completed.length})
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
                        {tr("Save routine day")}{" "}
                      </button>
                      <p className="text-xs text-white/45">
                        {tr(
                          "Counts this routine day toward your streak and locks its checkmarks.",
                        )}{" "}
                      </p>
                    </div>
                  )}
              </details>
            )}
            {paused.length > 0 && (
              <details className="border-t border-white/10 py-3">
                <summary className="cursor-pointer py-2 text-sm text-white/50">
                  {tr("Set aside today (")}
                  {paused.length})
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
                      {tr("Bring back")}{" "}
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
                  {tr("Make today lighter")}{" "}
                </button>
              )}
            {undo && undo.version === version && !editing && (
              <button
                disabled={action.busy}
                className={quiet}
                onClick={() =>
                  void action.run(() => persist(undo.state, { state, version }))
                }
              >
                {tr("Undo lighter day")}{" "}
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
        {!items.length && (
          <section aria-label={tr("Tasks & habits")} className={card}>
            <h2 className="font-semibold">{tr("Tasks & habits")}</h2>
            <p className="mt-2 text-sm text-white/50">
              {tr("Add tasks in Routines or track a habit to see it here.")}
            </p>
          </section>
        )}
      </>
    ),
    workout: <TodayWorkout compact onOpen={() => onNavigate("workout")} />,
    athkar: (
      <section aria-label={tr("Athkar")} className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{tr("Athkar")}</h2>
            <p className="mt-1 text-xs text-white/45">
              {tr("What is relevant right now.")}
            </p>
          </div>
          <button className={quiet} onClick={() => onNavigate("athkar")}>
            {tr("Open all")}
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          {!hasAthkarToday && (
            <p className="text-sm text-white/50">
              {tr(
                "Open Athkar for your saved categories and custom remembrance.",
              )}
            </p>
          )}
          {scheduledAthkar && (
            <button
              onClick={() => openAthkar(scheduledAthkar.category)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-start transition hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    {tr(scheduledAthkar.title)}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {tr(scheduledAthkar.startsAt)}–{tr(scheduledAthkar.endsAt)}
                  </div>
                </div>
                <span className="text-sm font-semibold text-white/70">
                  {scheduledCompletedThisWindow
                    ? tr("Completed")
                    : `${scheduledPercent}%`}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, scheduledPercent))}%`,
                  }}
                />
              </div>
              <div className="mt-3 text-xs text-white/45">
                {scheduledCompletedThisWindow
                  ? tr("Finished for this time window.")
                  : categorySession?.currentIndex
                    ? tr("Resume at item {0}.", {
                        0: categorySession.currentIndex + 1,
                      })
                    : tr("Continue from exactly where you stopped.")}
              </div>
            </button>
          )}

          {prayerClock.activePrayer && (
            <button
              onClick={() =>
                openAthkar("prayer", prayerClock.activePrayer?.sessionKey)
              }
              className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-start transition hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    {tr("After")} {prayerClock.activePrayer.name}{" "}
                    {tr("Prayer Athkar")}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {tr("Available for 1 hour after")}{" "}
                    {prayerClock.activePrayer.time}
                  </div>
                </div>
                <span className="text-sm font-semibold text-white/70">
                  {prayerSession?.completed
                    ? tr("Completed")
                    : `${prayerPercent}%`}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, prayerPercent))}%`,
                  }}
                />
              </div>
              <div className="mt-3 text-xs text-white/45">
                {prayerSession?.completed
                  ? tr("This prayer's Athkar is finished.")
                  : prayerSession?.currentIndex
                    ? tr("Resume at item {0}.", {
                        0: prayerSession.currentIndex + 1,
                      })
                    : tr("This prayer has its own saved session.")}
              </div>
            </button>
          )}
        </div>
      </section>
    ),
    routines: (
      <section aria-label={tr("Routines")} className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="routines" className="h-4 w-4 text-primary" />
            {tr("Routines")}
          </h2>
          <button className={quiet} onClick={() => onNavigate("routines")}>
            {tr("Open all")}
          </button>
        </div>
        {routines.length ? (
          <div className="mt-1 divide-y divide-white/5">
            {routines.slice(0, 3).map((routine) => (
              <button
                key={routine._id}
                onClick={() => onNavigate("routines")}
                className="flex min-h-14 w-full items-center gap-3 py-3 text-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {routine.timeSlot === "Flexible"
                      ? tr(routine.name)
                      : routine.name}
                  </span>
                  <span className="mt-1 block text-xs text-white/45">
                    {routine.timeSlot === "Flexible"
                      ? tr("Flexible")
                      : routine.timeSlot}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-primary">
                  {tr("{0}/{1} done", {
                    0: routine.tasks.filter((task) => task.completed).length,
                    1: routine.tasks.length,
                  })}
                </span>
                <Icon
                  name="chevronRight"
                  className="h-4 w-4 shrink-0 text-white/40"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/50">
            {tr(
              "Create a block or flexible routine to see your daily rhythm here.",
            )}
          </p>
        )}
      </section>
    ),
    consistency: (
      <HomeConsistency
        dateKey={dateKey}
        hiddenPages={preferences?.hiddenPages ?? []}
        onOpen={() => onNavigate("progress")}
      />
    ),
  };
  const available = (id: HomeSection) =>
    id === "routines"
      ? visible("routines")
      : id === "workout"
        ? visible("workout")
        : id === "athkar"
          ? visible("athkar")
          : id === "focus" || id === "tasks"
            ? visible("routines") || visible("habits")
            : true;
  const shown = home.order.filter(
    (id) => !home.hidden.includes(id) && available(id),
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={tr("Home")} subtitle={dateLabel} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">
            {displayName
              ? tr("Welcome back, {0}", { 0: displayName })
              : tr("Welcome back")}
          </h2>
          <p className="mt-1 text-xs text-white/50">
            {tr("Your day, at a glance.")}
          </p>
        </div>
        <button
          className={quiet + " flex min-w-11 items-center justify-center gap-2"}
          aria-label={tr("Customize Home")}
          aria-expanded={customizing}
          onClick={() => setCustomizing((value) => !value)}
        >
          <Icon name="settings" className="h-4 w-4" />
          <span className="hidden sm:inline">{tr("Customize Home")}</span>
        </button>
      </div>
      {customizing && (
        <HomeCustomization
          order={home.order}
          hidden={home.hidden}
          onClose={() => setCustomizing(false)}
        />
      )}
      {shown.map((id) => (
        <div key={id} data-home-section={id}>
          {sections[id]}
        </div>
      ))}
      {!shown.length && (
        <p className={card + " text-sm text-white/55"}>
          {tr(
            "Your Home sections are hidden. Customize Home or enable a section in My workspace.",
          )}
        </p>
      )}
      {action.error && !editing && (
        <p role="alert" className="text-sm text-red-300">
          {action.error}
        </p>
      )}
    </div>
  );
}
