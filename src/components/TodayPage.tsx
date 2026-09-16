import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  habitKey,
  taskKey,
  EMPTY_DAY,
  type DayState,
} from "../../convex/supportModel";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { useSaveAction } from "../hooks/useSaveAction";
import { PageHeader } from "./PageHeader";
import { toast } from "sonner";
import { TodayWorkout } from "./TodayWorkout";
import { TemplateGallery } from "./TemplateGallery";
import { DayAdjustment, type TodayItem } from "./DayAdjustment";
import { WeeklyReview } from "./WeeklyReview";

type Destination = "routines" | "habits" | "workout" | "progress";
const button =
  "min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50";
const card = "rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6";
type Props = { onNavigate: (page: Destination) => void; displayName: string };

export function TodayPage(props: Props) {
  const dateKey = useLocalDateKey();
  return <TodayContent key={dateKey} dateKey={dateKey} {...props} />;
}

function TodayContent({
  onNavigate,
  displayName,
  dateKey,
}: Props & { dateKey: string }) {
  const preferences = useQuery(api.workspace.getPreferences);
  const routines = useQuery(api.routines.getRoutines);
  const habits = useQuery(api.habits.getHabits);
  const days = useQuery(api.workouts.getWorkoutDays);
  const routineDay = useQuery(api.routines.getTodayProgress, { dateKey });
  const support = useQuery(api.daySupport.getToday, { dateKey });
  const toggleTask = useMutation(api.routines.toggleTask);
  const logHabit = useMutation(api.habits.logHabit);
  const saveDay = useMutation(api.daySupport.saveDay);
  const visit = useMutation(api.daySupport.visitToday);
  const completeDay = useMutation(api.routines.completeDay);
  const ensureStats = useMutation(api.routines.ensureUserStats);
  const action = useSaveAction();
  const [panel, setPanel] = useState<"templates" | "adjust" | "review" | null>(
    null,
  );
  const [adjustKey, setAdjustKey] = useState<string | undefined>();
  const [adjustBaseline, setAdjustBaseline] = useState<{
    state: DayState;
    version: number;
  } | null>(null);
  const [undo, setUndo] = useState<{ state: DayState; version: number } | null>(
    null,
  );
  const [showCompleted, setShowCompleted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void visit({ dateKey }).catch(() => {});
  }, [dateKey, visit]);
  useEffect(() => {
    if (panel)
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [panel, adjustKey]);

  if (
    !routines ||
    !habits ||
    !days ||
    routineDay === undefined ||
    preferences === undefined ||
    support === undefined
  ) {
    return (
      <p className="p-10 text-center text-white/60" role="status">
        Getting your day ready…
      </p>
    );
  }
  const visible = (page: Destination) =>
    !preferences?.hiddenPages.includes(page);
  const tasks = (visible("routines") ? routines : []).flatMap((routine) =>
    [...routine.tasks]
      .sort((a, b) => a.order - b.order)
      .map((task) => ({
        ...task,
        routineId: routine._id,
        routineName: routine.name,
        timeSlot: routine.timeSlot,
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
      group: `${task.routineName} · ${task.timeSlot}`,
      completed: task.completed,
      minutes: task.minutes,
      fallbackName: task.fallbackName,
      fallbackMinutes: task.fallbackMinutes,
      locked: routineDay?.countedInStats === true,
    })),
    ...activeHabits.map((habit) => ({
      key: habitKey(habit._id),
      name: habit.name,
      group:
        habit.type === "break"
          ? "Habit · Avoided today"
          : "Habit · Practiced today",
      completed: habit.entries.some(
        (entry) => entry.date === dateKey && entry.completed,
      ),
    })),
  ];
  const state = support?.state ?? EMPTY_DAY;
  const version = support?.version ?? 0;
  const adjustment = (key: string) =>
    state.adjustments.find((row) => row.key === key);
  const completed = items.filter((item) => item.completed);
  const paused = items.filter(
    (item) => !item.completed && adjustment(item.key)?.mode === "pause",
  );
  const smallDone = items.filter(
    (item) =>
      !item.completed &&
      adjustment(item.key)?.mode === "step" &&
      adjustment(item.key)?.stepDone,
  );
  const remaining = items.filter(
    (item) =>
      !item.completed &&
      !item.locked &&
      !paused.includes(item) &&
      !smallDone.includes(item),
  );
  const lockedUnfinished = items.filter(
    (item) =>
      !item.completed &&
      item.locked &&
      !paused.includes(item) &&
      !smallDone.includes(item),
  );
  const next =
    remaining.find((item) => item.key === state.focusKey) ?? remaining[0];
  const configured =
    items.length > 0 ||
    (visible("workout") && days.some((day) => day.exercises.length > 0));
  const pattern = support?.patterns.find((row) =>
    remaining.some((item) => item.key === row.key),
  );
  const clean = (value: DayState): DayState => ({
    ...value,
    focusKey: items.some((item) => item.key === value.focusKey)
      ? value.focusKey
      : "",
    startedKey: items.some((item) => item.key === value.startedKey)
      ? value.startedKey
      : "",
  });
  const persist = async (
    value: DayState,
    canUndo = true,
    baseline = { state, version },
  ) => {
    const savedVersion = await saveDay({
      dateKey,
      expectedVersion: baseline.version,
      state: clean(value),
    });
    setUndo(canUndo ? { state: baseline.state, version: savedVersion } : null);
  };
  const openAdjust = (key?: string) => {
    setAdjustBaseline({ state, version });
    setAdjustKey(key);
    action.setError("");
    setPanel("adjust");
  };
  const complete = (item: TodayItem) =>
    void action.run(async () => {
      const adapted = adjustment(item.key);
      if (adapted?.mode === "step" && !adapted.stepDone && !item.completed) {
        await persist({
          ...state,
          adjustments: state.adjustments.map((row) =>
            row.key === item.key ? { ...row, stepDone: true } : row,
          ),
        });
        toast.success("First step saved. The full action remains unfinished.");
        return;
      }
      const task = tasks.find((row) => row.key === item.key);
      if (task)
        await toggleTask({
          routineId: task.routineId,
          taskId: task.id,
          dateKey,
        });
      else {
        const habit = activeHabits.find(
          (row) => habitKey(row._id) === item.key,
        );
        if (habit)
          await logHabit({
            habitId: habit._id,
            completed: !item.completed,
            dateKey,
          });
      }
      toast.success(item.completed ? "Completion undone." : "Progress saved.");
    });
  const renderItem = (item: TodayItem) => {
    const adapted = adjustment(item.key);
    return (
      <li
        key={item.key}
        className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
      >
        <div className="flex items-start gap-3">
          <button
            disabled={action.busy || item.locked}
            onClick={() => complete(item)}
            aria-label={`${item.completed ? "Undo completion of" : adapted?.mode === "step" ? "Complete first step for" : "Complete"} ${item.name}`}
            aria-pressed={item.completed}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 text-[rgb(var(--sw-accent-rgb))] disabled:opacity-40"
          >
            {item.completed ? "✓" : "○"}
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={`break-words font-semibold ${item.completed ? "text-white/50" : ""}`}
            >
              {adapted?.mode === "step" && !item.completed
                ? adapted.step
                : item.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              {item.group}
              {item.minutes ? ` · Usual plan: ~${item.minutes} min` : ""}
            </p>
            {adapted?.mode === "step" && !item.completed && (
              <p className="mt-2 text-xs text-white/60">
                First step toward: {item.name}
              </p>
            )}
          </div>
        </div>
        {!item.completed && !item.locked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={button}
              disabled={action.busy}
              onClick={() =>
                void action.run(() => persist({ ...state, focusKey: item.key }))
              }
            >
              {state.focusKey === item.key ? "Main priority" : "Make priority"}
            </button>
            <button
              className={button}
              disabled={action.busy}
              onClick={() => openAdjust(item.key)}
            >
              Need a different approach?
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-fade-in">
      <PageHeader
        title="Today"
        subtitle={new Date(`${dateKey}T12:00:00`).toLocaleDateString(
          undefined,
          { weekday: "long", month: "long", day: "numeric" },
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/60">
          {displayName
            ? `Ready when you are, ${displayName}.`
            : "A manageable day starts with one action."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            disabled={action.busy}
            onClick={() => setPanel(panel === "templates" ? null : "templates")}
          >
            Templates
          </button>
          <button
            className={button}
            disabled={
              action.busy ||
              !items.some((item) => !item.completed && !item.locked)
            }
            onClick={() => openAdjust()}
          >
            Adjust today
          </button>
          <button
            className={button}
            disabled={action.busy}
            onClick={() => setPanel(panel === "review" ? null : "review")}
          >
            Weekly review
          </button>
        </div>
      </div>
      {support?.showWelcome && (
        <section className={card}>
          <h2 className="text-xl font-bold">
            Welcome back. Start with one thing.
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Your history is still here. Choose what matters today; you don't
            need to catch up on every missed routine.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={button}
              disabled={action.busy}
              onClick={() =>
                remaining.length ? openAdjust() : setPanel("templates")
              }
            >
              Choose a manageable start
            </button>
            <button
              className={button}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await visit({ dateKey, dismiss: true });
                })
              }
            >
              Continue with my day
            </button>
          </div>
        </section>
      )}
      <div ref={panelRef} className="scroll-mt-6">
        {(panel === "templates" || (!configured && panel === null)) && (
          <TemplateGallery
            dateKey={dateKey}
            onDone={() => setPanel(null)}
            onClose={configured ? () => setPanel(null) : undefined}
          />
        )}
        {panel === "adjust" && (
          <DayAdjustment
            key={adjustKey ?? "all"}
            state={adjustBaseline?.state ?? state}
            items={items}
            initialKey={adjustKey}
            busy={action.busy}
            error={action.error}
            onCancel={() => setPanel(null)}
            onApply={(value) =>
              void action.run(async () => {
                await persist(
                  value,
                  true,
                  adjustBaseline ?? { state, version },
                );
                setPanel(null);
                toast.success(
                  "Today's plan adjusted. Tomorrow's routine is unchanged.",
                );
              })
            }
          />
        )}
        {panel === "review" && (
          <WeeklyReview
            key={dateKey}
            dateKey={dateKey}
            routines={visible("routines") ? routines : []}
          />
        )}
      </div>
      {undo && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          role="status"
        >
          <p className="text-sm text-white/70">Today's plan was updated.</p>
          <button
            className={button}
            disabled={action.busy || undo.version !== version}
            onClick={() =>
              void action.run(async () => {
                await saveDay({
                  dateKey,
                  expectedVersion: undo.version,
                  state: clean(undo.state),
                });
                setUndo(null);
                toast.success("Last adjustment undone.");
              })
            }
          >
            Undo last change
          </button>
        </div>
      )}
      {action.error && panel !== "adjust" && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 p-4 text-sm text-red-300"
        >
          {action.error}
        </p>
      )}
      {configured && (
        <section className="overflow-hidden rounded-3xl border border-[rgb(var(--sw-accent-rgb)/.35)] bg-[rgb(var(--sw-accent-rgb)/.06)] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[rgb(var(--sw-accent-rgb))]">
            {next
              ? state.startedKey === next.key
                ? "In progress · At your pace"
                : "Your next useful action"
              : "A moment to pause"}
          </p>
          <h2 className="mt-3 max-w-3xl break-words text-2xl font-bold leading-tight sm:text-3xl">
            {next
              ? adjustment(next.key)?.mode === "step"
                ? adjustment(next.key)?.step
                : next.name
              : items.length
                ? paused.length || smallDone.length || lockedUnfinished.length
                  ? "Your day has room to breathe."
                  : "Your chosen actions are done for now."
                : "Your day, at your pace."}
          </h2>
          {next ? (
            <>
              <p className="mt-3 text-sm text-white/60">
                {next.group}
                {next.minutes
                  ? ` · Usual plan: about ${next.minutes} minutes`
                  : ""}
              </p>
              {adjustment(next.key)?.mode === "step" && (
                <p className="mt-2 text-sm text-white/65">
                  A first step toward “{next.name}”. The full action stays
                  unfinished.
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {state.startedKey !== next.key && (
                  <button
                    className="min-h-11 rounded-xl bg-[rgb(var(--sw-accent-rgb))] px-6 py-3 font-semibold text-black disabled:opacity-50"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(() =>
                        persist({
                          ...state,
                          focusKey: next.key,
                          startedKey: next.key,
                        }),
                      )
                    }
                  >
                    Start this action
                  </button>
                )}
                <button
                  className={button}
                  disabled={action.busy}
                  onClick={() => complete(next)}
                >
                  {adjustment(next.key)?.mode === "step"
                    ? "I've done this first step"
                    : "I've completed it"}
                </button>
                <button
                  className={button}
                  disabled={action.busy}
                  onClick={() => openAdjust(next.key)}
                >
                  I'm stuck
                </button>
              </div>
              {state.startedKey === next.key && (
                <p className="mt-4 text-xs text-white/55">
                  Your place is saved. Come back when you've made progress.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/65">
              {paused.length || smallDone.length
                ? "Smaller steps and paused actions are listed below. Your original commitments are still visible."
                : "You can leave it here. Your workout and other chosen sections are below when you need them."}
            </p>
          )}
        </section>
      )}
      {pattern && !preferences?.quiet && panel !== "adjust" && (
        <section
          className={`${card} flex flex-wrap items-center justify-between gap-4`}
        >
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Would a different approach help?</h2>
            <p className="mt-2 break-words text-sm leading-6 text-white/65">
              You adjusted “{pattern.title}” on {pattern.days} days in the last
              two weeks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={action.busy}
              onClick={() => openAdjust(pattern.key)}
            >
              Find a first step
            </button>
            <button
              className={button}
              disabled={action.busy}
              onClick={() =>
                void action.run(() =>
                  persist(
                    {
                      ...state,
                      dismissedFriction: [
                        ...new Set([
                          ...state.dismissedFriction,
                          ...support!.patterns.map((p) => p.key),
                        ]),
                      ].slice(0, 100),
                    },
                    false,
                  ),
                )
              }
            >
              Not today
            </button>
          </div>
        </section>
      )}
      {remaining.length > 1 && (
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Your other actions</h2>
            <p className="text-sm text-white/55">
              {remaining.length - 1} remaining after your next action
            </p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {remaining.filter((item) => item.key !== next?.key).map(renderItem)}
          </ul>
        </section>
      )}
      {(completed.length > 0 || smallDone.length > 0) && (
        <section className={card}>
          <h2 className="text-lg font-semibold">
            Progress that stays with you
          </h2>
          <p className="mt-2 text-sm text-white/65">
            {completed.length} full actions completed
            {smallDone.length
              ? ` · ${smallDone.length} smaller steps taken`
              : ""}{" "}
            today.
          </p>
          <button
            className={`${button} mt-4`}
            onClick={() => setShowCompleted((value) => !value)}
            aria-expanded={showCompleted}
          >
            {showCompleted ? "Hide details" : "View progress / undo"}
          </button>
          {showCompleted && (
            <>
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {completed.map(renderItem)}
              </ul>
              {smallDone.map((item) => (
                <div
                  key={item.key}
                  className="mt-3 rounded-xl border border-white/10 p-4"
                >
                  <p className="text-sm font-semibold">
                    ✓ {adjustment(item.key)?.step}
                  </p>
                  <p className="mt-2 text-xs text-white/60">
                    Original action still unfinished: {item.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={button}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(() =>
                          persist({
                            ...state,
                            adjustments: state.adjustments.map((row) =>
                              row.key === item.key
                                ? { ...row, stepDone: false }
                                : row,
                            ),
                          }),
                        )
                      }
                    >
                      Undo step
                    </button>
                    <button
                      className={button}
                      disabled={action.busy || item.locked}
                      onClick={() => complete(item)}
                    >
                      I've now completed the full action
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {paused.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer text-sm font-semibold">
            Paused today · {paused.length}
          </summary>
          <p className="mt-3 text-xs leading-5 text-white/60">
            These actions remain unfinished. Their usual routine returns
            tomorrow; no deadlines have been moved.
          </p>
          <ul className="mt-4 space-y-3">
            {paused.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="min-w-0 break-words text-sm">{item.name}</span>
                <button
                  className={button}
                  disabled={action.busy}
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
                  Bring back today
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {lockedUnfinished.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer text-sm font-semibold">
            Unfinished in your saved routine day · {lockedUnfinished.length}
          </summary>
          <p className="mt-3 text-xs text-white/60">
            These actions remain unfinished. The saved checklist is locked until
            tomorrow.
          </p>
          <ul className="mt-4 space-y-3">{lockedUnfinished.map(renderItem)}</ul>
        </details>
      )}
      {routineDay?.countedInStats ? (
        <p className="text-xs text-white/55">
          Your routine day is saved. Its checklist unlocks tomorrow.
        </p>
      ) : (
        tasks.length > 0 &&
        tasks.filter((t) => t.completed).length / tasks.length >= 0.8 && (
          <div className={card}>
            <p className="text-sm text-white/65">
              Save your routine day when you're finished. This locks its
              checkmarks until tomorrow.
            </p>
            <button
              className={`${button} mt-3`}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await ensureStats({});
                  await completeDay({ dateKey });
                  toast.success("Routine day saved.");
                })
              }
            >
              Save routine day
            </button>
          </div>
        )
      )}
      {support?.experiment && (
        <div className={card}>
          <p className="text-xs uppercase tracking-widest text-white/50">
            Your experiment for this week
          </p>
          <p className="mt-3 text-sm leading-6">
            {support.experiment.experiment}
          </p>
          <button
            className={`${button} mt-3`}
            onClick={() => setPanel("review")}
          >
            Reflect on this
          </button>
        </div>
      )}
      {visible("workout") && (
        <TodayWorkout onOpen={() => onNavigate("workout")} />
      )}
      <div className="flex flex-wrap gap-3">
        {visible("routines") && (
          <button className={button} onClick={() => onNavigate("routines")}>
            Manage routines
          </button>
        )}
        {visible("habits") && (
          <button className={button} onClick={() => onNavigate("habits")}>
            Manage habits
          </button>
        )}
        {visible("progress") && (
          <button className={button} onClick={() => onNavigate("progress")}>
            View progress
          </button>
        )}
      </div>
    </div>
  );
}
