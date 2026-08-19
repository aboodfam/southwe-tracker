import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTheme } from "../contexts/ThemeContext";
import { useSound } from "../contexts/SoundContext";
import { PageHeader } from "./PageHeader";
import { useLocalDateKey } from "../hooks/useLocalDateKey";

type HabitType = "build" | "break";

type HabitDoc = {
  _id: Id<"habits">;
  name: string;
  type: HabitType;
  currentStreak: number;
  longestStreak: number;
  entries: { date: string; completed: boolean }[];
};

function parseRgbTriplet(rgb: string): string {
  const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;

  const m2 = rgb.match(/(\d+)\s+(\d+)\s+(\d+)/);
  if (m2) return `${m2[1]} ${m2[2]} ${m2[3]}`;

  return "0 204 255";
}

function rgbaFromTriplet(triplet: string, a: number) {
  return `rgba(${triplet.replace(/\s+/g, ", ")}, ${a})`;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-500",
        "border border-white/10 backdrop-blur-lg",
        active
          ? "bg-white/10 text-white shadow-[0_10px_40px_rgb(var(--sw-accent-rgb) / 0.12)]"
          : "bg-black/30 text-white/55 hover:text-white/80 hover:bg-white/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StreakRing({
  current,
  best,
  accentTriplet,
}: {
  current: number;
  best: number;
  accentTriplet: string;
}) {
  const denom = Math.max(1, best || 1);
  const pct = clamp((current / denom) * 100);

  const style = {
    background: `conic-gradient(${rgbaFromTriplet(
      accentTriplet,
      0.95
    )} ${pct}%, rgba(255,255,255,0.08) 0)`,
  } as const;

  return (
    <div className="relative w-10 h-10 rounded-full p-[2px]" style={style}>
      <div className="w-full h-full rounded-full bg-black/60 border border-white/10 flex items-center justify-center">
        <div className="text-xs font-bold text-white">{current}</div>
      </div>
    </div>
  );
}

export function HabitsPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();
  const dateKey = useLocalDateKey();

  const accentTriplet = parseRgbTriplet(colors.primary);
  const accentLightTriplet = parseRgbTriplet(colors.primaryLight);

  const [activeTab, setActiveTab] = useState<HabitType>("build");
  const [isSwitching, setIsSwitching] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const habits = useQuery(api.habits.getHabits) as HabitDoc[] | undefined;
  const habitStats = useQuery(api.habits.getHabitStats, { dateKey });

  const addHabit = useMutation(api.habits.createHabit);
  const toggleHabit = useMutation(api.habits.logHabit);
  const deleteHabit = useMutation(api.habits.deleteHabit);

  const lastHabitsRef = useRef<HabitDoc[] | null>(null);

  useEffect(() => {
    if (habits && Array.isArray(habits)) {
      lastHabitsRef.current = habits;
    }
  }, [habits]);

  const safeHabits = habits ?? lastHabitsRef.current ?? [];
  const today = dateKey;

  const filtered = useMemo(() => {
    return safeHabits.filter((h) => h.type === activeTab);
  }, [safeHabits, activeTab]);

  const completedTodayCount = useMemo(() => {
    return filtered.filter((h) =>
      h.entries?.some((e) => e.date === today && e.completed)
    ).length;
  }, [filtered, today]);

  const switchTab = (next: HabitType) => {
    if (next === activeTab) return;

    setIsSwitching(true);
    window.setTimeout(() => {
      setActiveTab(next);
      window.setTimeout(() => setIsSwitching(false), 30);
    }, 240);
  };

  const openAdd = () => {
    setNewName("");
    setShowAdd(true);
  };

  const onAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Type a habit name.");
      return;
    }

    try {
      await addHabit({ name, type: activeTab });
      toast.success("Habit added.");
      play("notification", 0.85);
      setShowAdd(false);

      window.setTimeout(() => {
        const match = (lastHabitsRef.current ?? []).find(
          (h) => h.name === name && h.type === activeTab
        );

        if (match?._id) {
          setJustAddedId(match._id);
          window.setTimeout(() => setJustAddedId(null), 1600);
        }
      }, 80);
    } catch {
      toast.error("Failed to add habit.");
    }
  };

  const onToggle = async (habitId: Id<"habits">) => {
    try {
      const habit = filtered.find((h) => h._id === habitId);
      if (!habit) return;

      const doneToday = !!habit.entries?.some(
        (e) => e.date === today && e.completed
      );

      await toggleHabit({ habitId, completed: !doneToday, dateKey });

      if (!doneToday) {
        play("success", 0.95);
      }
    } catch {
      toast.error("Failed to update habit.");
    }
  };

  const onDelete = async (habitId: Id<"habits">) => {
    setDeletingId(habitId);

    window.setTimeout(async () => {
      try {
        await deleteHabit({ habitId });
        toast.success("Habit deleted.");
      } catch {
        toast.error("Failed to delete habit.");
      } finally {
        setDeletingId(null);
      }
    }, 280);
  };

  return (
    <div
      className="space-y-4 sm:space-y-5 animate-fade-in"
      style={
        {
          ["--sw-accent-rgb" as any]: accentTriplet.replace(/\s+/g, ", "),
          ["--sw-accent-light-rgb" as any]: accentLightTriplet.replace(
            /\s+/g,
            ", "
          ),
        } as any
      }
    >
      <PageHeader title="Habits" subtitle="Build good. Break bad." />

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-5 animate-slide-up max-w-5xl mx-auto">
        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          <div className="w-full flex flex-col items-center">
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Pill
                active={activeTab === "build"}
                onClick={() => switchTab("build")}
              >
                Build
              </Pill>

              <Pill
                active={activeTab === "break"}
                onClick={() => switchTab("break")}
              >
                Break
              </Pill>

              <button
                onClick={openAdd}
                className="ml-0 sm:ml-2 px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all duration-500"
                style={{
                  boxShadow: `0 18px 70px ${rgbaFromTriplet(
                    accentTriplet,
                    0.12
                  )}`,
                }}
              >
                + Add Habit
              </button>
            </div>
          </div>

          <div className="w-full max-w-md space-y-3 mt-2">
            <div className="rounded-2xl bg-black/35 border border-white/10 p-4 backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <div className="text-white/60 text-sm font-semibold">Today</div>
                <div className="text-white/45 text-xs">{today}</div>
              </div>

              <div className="mt-2 text-white text-2xl font-black tracking-tight">
                {completedTodayCount}/{filtered.length}
              </div>

              <div className="text-white/45 text-sm mt-1">
                completed in{" "}
                <span className="text-white/70 font-semibold">
                  {activeTab}
                </span>{" "}
                mode
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/35 p-2.5">
                  <div className="text-white/55 text-xs font-semibold">
                    Avg Completion
                  </div>
                  <div className="mt-1 text-white text-lg font-black">
                    {Math.round(habitStats?.averageCompletionRate || 0)}%
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/35 p-2.5">
                  <div className="text-white/55 text-xs font-semibold">
                    Total Habits
                  </div>
                  <div className="mt-1 text-white text-lg font-black">
                    {habitStats?.totalHabits || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isSwitching ? (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-soft-fade pointer-events-none" />
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-5 animate-slide-up-delayed">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-white font-bold text-base sm:text-lg">
              Protocols
            </div>
            <div className="text-white/45 text-sm" />
          </div>

          <div className="text-white/40 text-xs">
            {filtered.length ? `${filtered.length} habits` : ""}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 mb-6 text-center">
            <div className="text-white/70 font-semibold">
              No habits yet — add one and start.
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((h) => {
            const doneToday = !!h.entries?.some(
              (e) => e.date === today && e.completed
            );
            const isDeleting = deletingId === h._id;
            const isJustAdded = justAddedId === h._id;

            return (
              <div
                key={h._id}
                className={[
                  "relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl p-3.5 transition-all duration-700 hover:translate-y-[-2px] hover:border-white/20",
                  doneToday ? "bg-white/5" : "bg-black/35",
                  isDeleting
                    ? "opacity-0 translate-y-2 scale-[0.98]"
                    : "opacity-100 translate-y-0 scale-100",
                  isJustAdded ? "animate-pop-in" : "animate-soft-fade",
                ].join(" ")}
                style={{
                  boxShadow: doneToday
                    ? `0 24px 90px ${rgbaFromTriplet(accentTriplet, 0.14)}`
                    : `0 18px 70px rgba(0,0,0,0.25)`,
                }}
              >
                <div
                  className="absolute -inset-20 opacity-60 pointer-events-none"
                  style={{
                    background: `radial-gradient(420px 180px at 20% 0%, ${rgbaFromTriplet(
                      accentTriplet,
                      0.16
                    )}, transparent 60%),
                                 radial-gradient(420px 180px at 80% 30%, ${rgbaFromTriplet(
                                   accentLightTriplet,
                                   0.12
                                 )}, transparent 62%)`,
                  }}
                />

                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-bold truncate">
                        {h.name}
                      </div>

                      <span
                        className="text-[10px] px-2 py-1 rounded-full border border-white/10"
                        style={{
                          color: doneToday
                            ? rgbaFromTriplet(accentTriplet, 0.9)
                            : "rgba(255,255,255,0.55)",
                          background: doneToday
                            ? rgbaFromTriplet(accentTriplet, 0.1)
                            : "rgba(255,255,255,0.04)",
                        }}
                      >
                        {doneToday ? "DONE" : "PENDING"}
                      </span>
                    </div>

                    <div className="text-white/45 text-xs mt-1">
                      Mode:{" "}
                      <span className="text-white/70 font-semibold">
                        {h.type}
                      </span>
                    </div>
                  </div>

                  <StreakRing
                    current={h.currentStreak || 0}
                    best={h.longestStreak || 0}
                    accentTriplet={accentTriplet}
                  />
                </div>

                <div className="relative z-10 mt-4 flex items-center justify-between">
                  <div className="text-white/55 text-xs">
                    Best:{" "}
                    <span className="text-white/80 font-semibold">
                      {h.longestStreak || 0}
                    </span>{" "}
                    days
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggle(h._id)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all duration-500"
                      style={{
                        boxShadow: doneToday
                          ? `0 18px 60px ${rgbaFromTriplet(
                              accentTriplet,
                              0.12
                            )}`
                          : undefined,
                      }}
                    >
                      {doneToday ? "Undo" : "Complete"}
                    </button>

                    <button
                      onClick={() => onDelete(h._id)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-black/30 hover:bg-white/5 text-white/80 transition-all duration-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAdd(false)}
          />

          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl p-4 sm:p-5 animate-scale-in">
            <div className="text-white font-black text-xl sm:text-2xl">
              Add Habit
            </div>
            <div className="text-white/45 text-sm mt-1">
              Create a protocol for your future self.
            </div>

            <div className="mt-5 space-y-3">
              <label className="text-white/60 text-xs font-semibold">
                Name
              </label>

              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={
                  activeTab === "build"
                    ? "e.g., Read 10 pages"
                    : "e.g., No sugar"
                }
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all"
                style={{
                  boxShadow: `0 0 0 1px ${rgbaFromTriplet(
                    accentTriplet,
                    0.18
                  )}, 0 18px 70px ${rgbaFromTriplet(accentTriplet, 0.08)}`,
                }}
              />

              <div className="flex items-center justify-between gap-2">
                <div className="text-white/55 text-sm">
                  Mode:{" "}
                  <span className="text-white font-semibold">{activeTab}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 text-white/80 transition-all duration-500"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={onAdd}
                    className="px-4 py-2 rounded-xl border border-white/10 text-black font-bold transition-all duration-500"
                    style={{
                      background: `linear-gradient(90deg, ${rgbaFromTriplet(
                        accentTriplet,
                        1
                      )} 0%, ${rgbaFromTriplet(accentLightTriplet, 1)} 100%)`,
                      boxShadow: `0 18px 70px ${rgbaFromTriplet(
                        accentTriplet,
                        0.18
                      )}`,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="text-white/35 text-xs">
                Tip: set it small enough that you can’t say no.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}