import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../contexts/ThemeContext";
import { useSound } from "../contexts/SoundContext";
import { toast } from "sonner";
import { useLocalDateKey } from "../hooks/useLocalDateKey";

type WorkoutDay = {
  _id: Id<"workoutDays">;
  name: string;
  warmupNotes?: string;
  order: number;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: string | number;
    weight?: number;
    duration?: number;
    completed?: boolean;
    muscles?: string;
    isWarmup?: boolean;
    notes?: string;
    order?: number;
  }[];
};

const MUSCLE_CATEGORIES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Abs",
  "Calves",
  "Forearms/Grip",
  "Cardio",
  "Full Body",
  "Mobility",
  "Other",
] as const;

const SPLITS = {
  days: {
    label: "Days Split (Day 1 → Day 7)",
    names: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
  },
  ppl: {
    label: "Push / Pull / Legs",
    names: ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"],
  },
  bro: {
    label: "Bro Split",
    names: ["Chest", "Back", "Shoulders", "Arms", "Legs", "Abs", "Rest"],
  },
  arnold: {
    label: "Arnold Split",
    names: ["Chest & Back", "Shoulders & Arms", "Legs", "Chest & Back", "Shoulders & Arms", "Legs", "Rest"],
  },
} as const;

function rgbaFromRgb(rgb: string, a: number) {
  // rgb like "rgb(34, 211, 238)"
  const m = rgb.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) return `rgba(255,255,255,${a})`;
  return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
}

export function WorkoutPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const accent = colors.primary;
  const { play } = useSound();
  const dateKey = useLocalDateKey();

  // IMPORTANT: keep `undefined` while loading so we don't accidentally create defaults too early.
  const rawDays = useQuery(api.workouts.getWorkoutDays);
  const daysLoading = rawDays === undefined;
  const days = (rawDays ?? []) as WorkoutDay[];

  const stats = useQuery(api.workouts.getWorkoutStats);

  const createDay = useMutation(api.workouts.createWorkoutDay);
  const updateDay = useMutation(api.workouts.updateWorkoutDay);
  const deleteDay = useMutation(api.workouts.deleteWorkoutDay);

  const addExercise = useMutation(api.workouts.addExercise);
  const updateExercise = useMutation(api.workouts.updateExercise);
  const deleteExercise = useMutation(api.workouts.deleteExercise);

  const toggleComplete = useMutation(api.workouts.toggleExerciseComplete);
  const completeWorkout = useMutation(api.workouts.completeWorkout);
  const applyWorkoutSplit = useMutation(api.workouts.applyWorkoutSplit);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const initRef = useRef(false);

  // Optimistic exercises (fallback if Convex sync is slow / mobile network hiccups)
  const [optimisticExercises, setOptimisticExercises] = useState<Record<string, WorkoutDay["exercises"]>>({});


  // Create default days ONCE, after the first successful load that returns zero days.
  useEffect(() => {
    if (daysLoading) return;
    if (initRef.current) return;
    if (days.length > 0) return;

    initRef.current = true;
    (async () => {
      try {
        for (const name of SPLITS.days.names) {
          await createDay({ name });
        }
        toast.success("Default workout days created");
      } catch (e: any) {
        // allow retry if auth wasn't ready yet
        initRef.current = false;
        toast.error(e?.message ?? "Failed to create default days");
      }
    })();
  }, [daysLoading, days.length, createDay]);

  useEffect(() => {
    if (selectedIdx >= days.length) setSelectedIdx(0);
  }, [days.length, selectedIdx]);

  const selectedDay = days[selectedIdx];

  // Convex: skip query until we actually have a selected day
  const todayProgress = useQuery(
    api.workouts.getTodayWorkoutProgress,
    selectedDay ? { dayId: selectedDay._id, dateKey } : ("skip" as any)
  );

  const completedSet = useMemo(() => {
    const arr = (todayProgress as any)?.completedExercises;
    return new Set<string>(Array.isArray(arr) ? arr : []);
  }, [todayProgress]);


  const mergedDayExercises = useMemo(() => {
  if (!selectedDay) return [];
  const base = Array.isArray(selectedDay.exercises) ? selectedDay.exercises : [];
  const extras = optimisticExercises[String(selectedDay._id)] ?? [];
  if (!extras.length) return base;

  const baseIds = new Set(base.map((e) => e.id));
  return [...base, ...extras.filter((e) => !baseIds.has(e.id))];
  }, [selectedDay, optimisticExercises]);


  // If Convex later returns the same exercises, drop the optimistic copies.
  useEffect(() => {
  if (!selectedDay) return;
  const dayKey = String(selectedDay._id);
  const extras = optimisticExercises[dayKey];
  if (!extras?.length) return;

  const baseIds = new Set((selectedDay.exercises ?? []).map((e) => e.id));
  const remaining = extras.filter((e) => !baseIds.has(e.id));
  if (remaining.length === extras.length) return;

  setOptimisticExercises((prev) => {
    const next = { ...prev };
    if (remaining.length) next[dayKey] = remaining;
    else delete next[dayKey];
    return next;
  });
  }, [selectedDay, optimisticExercises]);

// Warmups are removed from the UI; we also hide existing warmup exercises to avoid confusion.
  const orderedExercises = useMemo(() => {
    if (!selectedDay) return [];
    const list = [...mergedDayExercises]
      .filter((e) => !e.isWarmup)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return list;
  }, [mergedDayExercises]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof orderedExercises>();
    for (const ex of orderedExercises) {
      const key =
        ex.muscles?.split(",")[0]?.trim() || ex.muscles?.trim() || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    }
    return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
  }, [orderedExercises]);

  const total = orderedExercises.length;
  const done = orderedExercises.reduce(
    (acc, ex) => acc + (completedSet.has(ex.id) ? 1 : 0),
    0
  );
  const rate = total > 0 ? (done / total) * 100 : 0;

  // ---- Split switcher ----
  const [splitKey, setSplitKey] = useState<keyof typeof SPLITS>("days");
  const [showSplitConfirm, setShowSplitConfirm] = useState(false);
  const [applyingSplit, setApplyingSplit] = useState(false);

  // light inference (no risk if wrong)
  useEffect(() => {
    if (daysLoading) return;
    if (days.length < 3) return;

    const a = days[0]?.name?.toLowerCase?.() ?? "";
    const b = days[1]?.name?.toLowerCase?.() ?? "";
    const c = days[2]?.name?.toLowerCase?.() ?? "";

    if (a.includes("push") && b.includes("pull") && c.includes("leg")) {
      setSplitKey("ppl");
      return;
    }
    if (
      (a.includes("chest") && a.includes("back")) ||
      (b.includes("shoulder") && b.includes("arm"))
    ) {
      setSplitKey("arnold");
      return;
    }
    if (
      ["chest", "back", "shoulder", "arms", "legs", "abs"].some((k) =>
        a.includes(k)
      )
    ) {
      setSplitKey("bro");
      return;
    }
    setSplitKey("days");
  }, [daysLoading, days]);

  const applySplitTemplate = () => {
    if (daysLoading || applyingSplit) return;
    if (days.length === 0) return;
    setShowSplitConfirm(true);
  };

  const confirmApplySplit = async () => {
    if (applyingSplit) return;
    const template = [...SPLITS[splitKey].names];

    // Close the confirmation immediately. The backend applies the whole split
    // in one transaction, so users never watch day names update one-by-one.
    setShowSplitConfirm(false);
    setApplyingSplit(true);
    try {
      await applyWorkoutSplit({ names: template });
      setSelectedIdx(0);
      toast.success("Split applied");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to apply split");
    } finally {
      setApplyingSplit(false);
    }
  };

  // ---- Edit Day modal ----
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayEditId, setDayEditId] = useState<Id<"workoutDays"> | null>(null);
  const [dayName, setDayName] = useState("");

  const openEditDay = () => {
    if (!selectedDay) return;
    setDayEditId(selectedDay._id);
    setDayName(selectedDay.name);
    setDayModalOpen(true);
  };

  const saveDay = async () => {
    if (!dayEditId) return;
    const n = dayName.trim();
    if (!n) return toast.error("Day name is required");

    try {
      await updateDay({ dayId: dayEditId, name: n, warmupNotes: undefined });
      toast.success("Day updated");
      setDayModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  // ---- Exercise modal ----
  const [exModalOpen, setExModalOpen] = useState(false);
  const [exEditId, setExEditId] = useState<string | null>(null);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState(3);
  const [exReps, setExReps] = useState("8-12");
  const [exMuscles, setExMuscles] = useState<(typeof MUSCLE_CATEGORIES)[number]>(
    "Chest"
  );
  const [exNotes, setExNotes] = useState("");

  const openAddExercise = (prefillMuscle?: string) => {
    if (!selectedDay) return;
    setExEditId(null);
    setExName("");
    setExSets(3);
    setExReps("8-12");

    const hit = (MUSCLE_CATEGORIES as readonly string[]).find(
      (m) => m.toLowerCase() === (prefillMuscle ?? "").toLowerCase()
    );
    setExMuscles((hit as any) ?? "Chest");

    setExNotes("");
    setExModalOpen(true);
  };

  const openEditExercise = (ex: WorkoutDay["exercises"][number]) => {
    setExEditId(ex.id);
    setExName(ex.name);
    setExSets(ex.sets);
    setExReps(String(ex.reps));

    const hit = (MUSCLE_CATEGORIES as readonly string[]).find(
      (m) => m.toLowerCase() === (ex.muscles ?? "").toLowerCase()
    );
    setExMuscles((hit as any) ?? "Other");

    setExNotes(ex.notes ?? "");
    setExModalOpen(true);
  };

  const saveExercise = async () => {
    if (!selectedDay) return;
    const n = exName.trim();
    const r = exReps.trim();
    const m = String(exMuscles).trim();
    if (!n) return toast.error("Exercise name is required");
    if (!r) return toast.error("Reps is required");
    if (!m) return toast.error("Muscles is required");

    try {
      if (exEditId) {
        await updateExercise({
          dayId: selectedDay._id,
          exerciseId: exEditId,
          name: n,
          sets: exSets,
          reps: r,
          muscles: m,
          isWarmup: false,
          notes: exNotes.trim() || undefined,
        });
        toast.success("Exercise updated");
      } else {
        const created = await addExercise({
  dayId: selectedDay._id,
  name: n,
  sets: exSets,
  reps: r,
  muscles: m,
  isWarmup: false,
  notes: exNotes.trim() || undefined,
});

// If the network is flaky, Convex query updates can lag on mobile.
// Show the new exercise immediately as a fallback.
if (created && typeof (created as any).id === "string") {
  const dayKey = String(selectedDay._id);
  setOptimisticExercises((prev) => {
    const current = prev[dayKey] ?? [];
    return { ...prev, [dayKey]: [...current, created as any] };
  });
}

toast.success("Exercise added");
play("notification", 0.9);
      }
      setExModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const doDeleteExercise = async () => {
    if (!selectedDay || !exEditId) return;
    try {
      await deleteExercise({ dayId: selectedDay._id, exerciseId: exEditId });
      toast.success("Exercise deleted");
      setExModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const doToggle = async (exerciseId: string) => {
    if (!selectedDay) return;
    const willComplete = !completedSet.has(exerciseId);
    try {
      const res: any = await toggleComplete({ dayId: selectedDay._id, exerciseId, dateKey });

      // Reward only when marking an exercise as complete (not when unchecking)
      if (willComplete) {
        const nextRate = typeof res?.completionRate === "number" ? res.completionRate : undefined;
        if (nextRate !== undefined && nextRate >= 99.9) {
          play("complete", 1.1);
        } else {
          play("success", 0.75);
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const doCompleteWorkout = async () => {
    if (!selectedDay) return;
    try {
      await completeWorkout({ dayId: selectedDay._id, dateKey });
      play("complete", 1.15);
      toast.success("Workout saved as complete.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not complete workout");
    }
  };

  // Delete day modal
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);
  const doDeleteDay = async () => {
    if (!selectedDay) return;
    try {
      await deleteDay({ dayId: selectedDay._id });
      toast.success("Day deleted");
      setConfirmDeleteDay(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const glow = rgbaFromRgb(accent, 0.18);
  const glowSoft = rgbaFromRgb(accent, 0.10);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center pt-2 sm:pt-4 animate-float-in">
        <div className="relative inline-block">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
            style={{ color: colors.primary }}
          >
            Workout Routine
          </h1>
          <div
            className="absolute -inset-4 sm:-inset-6 blur-2xl opacity-60 pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${glow}, transparent 60%)`,
            }}
          />
        </div>

        <p className="mt-2 sm:mt-3 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
          Build strength, one rep at a time
        </p>

        <div className="mt-3 sm:mt-4 flex justify-center">
          <div
            className="h-[3px] w-20 sm:w-28 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 18px ${glowSoft}`,
            }}
          />
        </div>
      </div>

      {/* Split selector */}
      <div
        className="rounded-2xl border bg-black/30 p-3 sm:p-4 md:p-5"
        style={{ borderColor: rgbaFromRgb(accent, 0.18) }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Split Template</div>
            <div className="text-xs text-white/45">Pick a split → apply → then edit exercises freely.</div>
          </div>

          <div className="flex gap-2">
            <select
              value={splitKey}
              onChange={(e) => setSplitKey(e.target.value as any)}
              disabled={applyingSplit}
              className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm text-white/85 focus:outline-none focus:border-white/20 min-w-0 flex-1 sm:flex-none disabled:cursor-wait disabled:opacity-50"
            >
              {Object.entries(SPLITS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            <button
              onClick={applySplitTemplate}
              disabled={applyingSplit}
              className="px-3 sm:px-4 py-2 rounded-xl font-semibold text-black text-sm whitespace-nowrap disabled:cursor-wait disabled:opacity-60"
              style={{
                background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.75)})`,
                boxShadow: `0 0 22px ${rgbaFromRgb(accent, 0.14)}`,
              }}
            >
              {applyingSplit ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Workouts" value={stats?.totalWorkouts ?? 0} delayMs={40} />
        <StatCard title="Current Streak" value={stats?.currentStreak ?? 0} delayMs={80} />
        <StatCard title="Longest Streak" value={stats?.longestStreak ?? 0} delayMs={120} />
        <StatCard
          title="Avg Completion"
          value={`${Math.round(stats?.averageCompletionRate ?? 0)}%`}
          delayMs={160}
        />
      </div>

      {/* Day tabs - Responsive grid layout */}
      <div className="relative">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          <div className="contents">
            {days.map((d, i) => {
              const active = i === selectedIdx;
              const isRestLike =
                d.name.toLowerCase().includes("rest") || (d.exercises?.length ?? 0) === 0;

              return (
                <button
                  key={d._id}
                  onClick={() => setSelectedIdx(i)}
                  className={[
                    "rounded-xl border px-3 sm:px-4 md:px-5 py-3 sm:py-4",
                    "transition-all duration-200",
                    "animate-float-in",
                    "bg-black/30 hover:bg-black/40",
                    active ? "scale-[1.02]" : "opacity-90",
                  ].join(" ")}
                  style={{
                    ["--delay" as any]: `${200 + i * 25}ms`,
                    borderColor: active ? rgbaFromRgb(accent, 0.55) : "rgba(255,255,255,0.10)",
                    boxShadow: active ? `0 0 24px ${rgbaFromRgb(accent, 0.18)}` : "none",
                  }}
                >
                  <div
                    className="text-[10px] sm:text-[11px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Day {i + 1}
                  </div>
                  <div
                    className="text-xs sm:text-sm font-bold truncate"
                    style={{ color: active ? colors.primary : "rgba(255,255,255,0.80)" }}
                    title={d.name}
                  >
                    {d.name}
                  </div>
                  <div className="text-[10px] sm:text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {isRestLike ? "Rest" : "Train"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading hint */}
      {daysLoading && (
        <div className="text-center text-white/50 text-sm">Loading workout…</div>
      )}

      {/* Main panel */}
      {selectedDay && (
        <div className="space-y-4 sm:space-y-5">
          {/* Top card */}
          <div
            className="rounded-2xl border bg-black/30 p-4 sm:p-5 md:p-6 animate-float-in"
            style={{
              ["--delay" as any]: "120ms",
              borderColor: rgbaFromRgb(accent, 0.25),
              boxShadow: `0 0 40px ${rgbaFromRgb(accent, 0.08)}`,
            }}
          >
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg md:text-xl font-bold text-white truncate">
                  Day {selectedIdx + 1}: {selectedDay.name}
                </div>
                <div className="mt-1 sm:mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Progress
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  onClick={openEditDay}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition text-xs sm:text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDeleteDay(true)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 hover:bg-red-500/15 transition text-xs sm:text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-white/60">
              <span>
                {done}/{total} ({Math.round(rate)}%)
              </span>
            </div>

            <div className="mt-2 sm:mt-3 h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${rate}%`,
                  background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.55)})`,
                }}
              />
            </div>

            {total > 0 && (
              <button
                onClick={() => void doCompleteWorkout()}
                disabled={(todayProgress as any)?.completedWorkout === true || rate < 70}
                className={[
                  "mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                  (todayProgress as any)?.completedWorkout === true
                    ? "cursor-not-allowed border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : rate >= 70
                      ? "text-black hover:brightness-110"
                      : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/35",
                ].join(" ")}
                style={
                  rate >= 70 && (todayProgress as any)?.completedWorkout !== true
                    ? { background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.72)})` }
                    : undefined
                }
              >
                {(todayProgress as any)?.completedWorkout === true
                  ? "Workout Completed"
                  : rate >= 70
                    ? "Complete Workout"
                    : `Reach 70% to complete (${Math.round(rate)}%)`}
              </button>
            )}
          </div>

          {/* No exercises */}
          {orderedExercises.length === 0 ? (
            <SectionCard title="Exercises" subtitle="" accent={accent}>
              <div className="space-y-3">
                <div className="text-white/55 text-sm">No exercises yet.</div>
                <button
                  onClick={() => openAddExercise()}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                >
                  + Add Exercise
                </button>
              </div>
            </SectionCard>
          ) : (
            grouped.map((g, gi) => (
              <div
                key={g.title}
                className="animate-float-in"
                style={{ ["--delay" as any]: `${180 + gi * 60}ms` }}
              >
                <SectionCard title={g.title} subtitle="" accent={accent}>
                <div className="space-y-2">
                  {g.items.map((ex, ei) => (
                    <div
                      key={ex.id}
                      className="animate-float-in"
                      style={{ ["--delay" as any]: `${220 + gi * 60 + ei * 35}ms` }}
                    >
                      <ExerciseRow
                        ex={ex}
                        checked={completedSet.has(ex.id)}
                        onToggle={() => doToggle(ex.id)}
                        onEdit={() => openEditExercise(ex)}
                        accent={accent}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => openAddExercise(g.title)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 py-2.5 sm:py-3 text-sm text-white/70 hover:text-white/90 hover:bg-black/35 transition"
                  >
                    + Add {g.title} Exercise
                  </button>
                </div>
                </SectionCard>
              </div>
            ))
          )}

          {/* Quick add button */}
          <div className="max-w-4xl mx-auto animate-float-in" style={{ ["--delay" as any]: "520ms" }}>
            <button
              onClick={() => openAddExercise()}
              className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5 text-white/70 hover:text-white/90 hover:border-white/20 transition"
              style={{ boxShadow: `0 0 40px ${rgbaFromRgb(accent, 0.06)}` }}
            >
              <div className="text-sm font-semibold">+ Add Exercise</div>
              <div className="text-xs text-white/40 mt-1">Pick a muscle category, set reps, done.</div>
            </button>
          </div>
        </div>
      )}

      {/* Day modal */}
      {dayModalOpen && (
        <Modal onClose={() => setDayModalOpen(false)} accent={accent} title="Edit Day">
          <div className="space-y-3">
            <label className="text-xs text-white/55">Day name</label>
            <input
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20"
              placeholder="Push / Pull / Legs / Day 1..."
              autoFocus
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveDay}
                className="flex-1 rounded-xl py-2 font-semibold text-black"
                style={{
                  background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.75)})`,
                }}
              >
                Save
              </button>
              <button
                onClick={() => setDayModalOpen(false)}
                className="flex-1 rounded-xl py-2 font-semibold bg-white/10 text-white hover:bg-white/15 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Exercise modal */}
      {exModalOpen && selectedDay && (
        <Modal
          onClose={() => setExModalOpen(false)}
          accent={accent}
          title={exEditId ? "Edit Exercise" : "Add Exercise"}
        >
          <div className="space-y-3">
            <label className="text-xs text-white/55">Name</label>
            <input
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20"
              placeholder="Exercise name"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/55">Sets</label>
                <input
                  type="number"
                  value={exSets}
                  onChange={(e) => setExSets(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 focus:outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/55">Reps</label>
                <input
                  value={exReps}
                  onChange={(e) => setExReps(e.target.value)}
                  className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20"
                  placeholder="8-12 / 30s hold"
                />
              </div>
            </div>

            <label className="text-xs text-white/55">Muscle Category</label>
            <select
              value={exMuscles}
              onChange={(e) => setExMuscles(e.target.value as any)}
              className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 focus:outline-none focus:border-white/20"
            >
              {MUSCLE_CATEGORIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label className="text-xs text-white/55">Notes (optional)</label>
            <input
              value={exNotes}
              onChange={(e) => setExNotes(e.target.value)}
              className="w-full rounded-xl bg-black/35 border border-white/10 px-3 py-2 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20"
              placeholder="Optional notes"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveExercise}
                className="flex-1 rounded-xl py-2 font-semibold text-black"
                style={{
                  background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.75)})`,
                }}
              >
                Save
              </button>

              {exEditId ? (
                <button
                  onClick={doDeleteExercise}
                  className="rounded-xl py-2 px-4 font-semibold bg-red-500/12 border border-red-500/20 text-red-200 hover:bg-red-500/18 transition"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={() => setExModalOpen(false)}
                  className="flex-1 rounded-xl py-2 font-semibold bg-white/10 text-white hover:bg-white/15 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm delete day modal */}
      {confirmDeleteDay && (
        <Modal onClose={() => setConfirmDeleteDay(false)} accent={accent} title="Delete this day?">
          <div className="text-white/70 text-sm">
            This permanently deletes this workout day and its exercises. Historical progress stays intact.
          </div>
          <div className="flex gap-2 pt-4">
            <button
              onClick={doDeleteDay}
              className="flex-1 rounded-xl py-2 font-semibold bg-red-500/15 border border-red-500/20 text-red-200 hover:bg-red-500/20 transition"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDeleteDay(false)}
              className="flex-1 rounded-xl py-2 font-semibold bg-white/10 text-white hover:bg-white/15 transition"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Split confirmation modal */}
      {showSplitConfirm && (
        <Modal onClose={() => setShowSplitConfirm(false)} accent={accent} title="Apply Split?">
          <div className="text-white/70 text-sm mb-4">
            Rename days to <strong className="text-white">{SPLITS[splitKey].label}</strong> template?
          </div>
          <div className="flex gap-2">
            <button onClick={confirmApplySplit} className="flex-1 rounded-xl py-2 font-semibold text-black" style={{ background: `linear-gradient(90deg, ${rgbaFromRgb(accent, 1)}, ${rgbaFromRgb(accent, 0.75)})` }}>Apply</button>
            <button onClick={() => setShowSplitConfirm(false)} className="flex-1 rounded-xl py-2 font-semibold bg-white/10 text-white hover:bg-white/15 transition">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  delayMs = 0,
}: {
  title: string;
  value: any;
  delayMs?: number;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4 animate-float-in"
      style={{ ["--delay" as any]: `${delayMs}ms` }}
    >
      <div className="text-xs text-white/55">{title}</div>
      <div className="mt-1 sm:mt-2 text-lg sm:text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  accent,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-black/30 p-4 sm:p-5 md:p-6"
      style={{ borderColor: rgbaFromRgb(accent, 0.22) }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-3 sm:mb-4">
        <div className="text-sm sm:text-base md:text-lg font-bold text-white">{title}</div>
        {subtitle ? <div className="text-xs text-white/45">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ExerciseRow({
  ex,
  checked,
  onToggle,
  onEdit,
  accent,
}: {
  ex: { 
    id: string; 
    name: string; 
    sets: number; 
    reps: string | number; 
    weight?: number;
    duration?: number;
    completed?: boolean;
    muscles?: string; 
    isWarmup?: boolean;
    notes?: string;
    order?: number;
  };
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 hover:bg-black/35 transition p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
      <button
        onClick={onToggle}
        className="mt-0.5 sm:mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-md border flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: checked ? rgbaFromRgb(accent, 0.8) : "rgba(255,255,255,0.18)",
          background: checked ? rgbaFromRgb(accent, 0.18) : "transparent",
        }}
        title="Complete"
      >
        {checked ? <span style={{ color: "white", fontSize: 10 }}>✓</span> : null}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{ex.name}</div>
        <div className="mt-1 text-xs text-white/55">
          {ex.sets} sets × {ex.reps} • {ex.muscles || 'No muscle group'}
          {ex.notes ? <span className="text-white/40"> • {ex.notes}</span> : null}
        </div>
      </div>

      <button
        onClick={onEdit}
        className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-white/75 hover:bg-white/10 transition text-xs flex-shrink-0"
      >
        Edit
      </button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  accent: string;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid min-h-[100dvh] place-items-center overflow-hidden p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/75"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className="relative z-10 w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-[#090909] p-4 shadow-2xl animate-scale-in sm:max-h-[calc(100dvh-2rem)] sm:p-5 md:p-6"
        style={{
          borderColor: rgbaFromRgb(accent, 0.25),
          boxShadow: `0 0 60px ${rgbaFromRgb(accent, 0.10)}`,
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="text-base font-bold text-white sm:text-lg">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/5 hover:text-white/90"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

