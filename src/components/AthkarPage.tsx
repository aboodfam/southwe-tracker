import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useSound } from "../contexts/SoundContext";
import { useTheme } from "../contexts/ThemeContext";

interface Dhikr {
  _id: string;
  text: string;
  translation?: string;
  targetCount: number;
  currentCount: number;
  category: string;
  isCompleted: boolean;
}

type CategoryDef = {
  id: string;
  name: string;
  icon: string;
  accentClass: string;
  accentStyle: string;
  description: string;
};

function getLocalDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCompletionDatesKey(category: string) {
  return `athkar_completed_dates_${category}`;
}

function readCompletionDates(category: string): string[] {
  try {
    const raw = localStorage.getItem(getCompletionDatesKey(category));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCompletionDates(category: string, dates: string[]) {
  try {
    localStorage.setItem(getCompletionDatesKey(category), JSON.stringify(dates));
  } catch {}
}

const categories: CategoryDef[] = [
  { id: "morning", name: "Morning Athkar", icon: "☀️", accentClass: "from-sky-500 via-blue-500 to-indigo-600", accentStyle: "rgba(59,130,246,0.26)", description: "Start the day with remembrance and protection." },
  { id: "evening", name: "Evening Athkar", icon: "🌙", accentClass: "from-violet-500 via-fuchsia-500 to-purple-700", accentStyle: "rgba(168,85,247,0.26)", description: "Close the day with calm and reflection." },
  { id: "before_sleep", name: "Before Sleep", icon: "🛏️", accentClass: "from-pink-500 via-fuchsia-500 to-purple-700", accentStyle: "rgba(236,72,153,0.26)", description: "Sleep with peace, remembrance, and trust." },
  { id: "prayer", name: "After Prayer", icon: "🤲", accentClass: "from-emerald-500 via-green-500 to-teal-600", accentStyle: "rgba(34,197,94,0.26)", description: "Keep the prayer connected to remembrance." },
  { id: "waking_up", name: "Upon Waking", icon: "🌅", accentClass: "from-cyan-500 via-sky-500 to-blue-600", accentStyle: "rgba(6,182,212,0.26)", description: "Begin waking moments with gratitude." },
  { id: "custom", name: "Custom Dhikr", icon: "✨", accentClass: "from-amber-400 via-orange-500 to-amber-600", accentStyle: "rgba(251,191,36,0.26)", description: "Save your own personal remembrance list." },
];

export function AthkarPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();

  const athkarRaw = useQuery(api.athkar.getAthkar);
  const athkar = athkarRaw ?? [];
  const isLoadingAthkar = athkarRaw === undefined;

  const incrementCount = useMutation(api.athkar.incrementCount);
  const resetCount = useMutation(api.athkar.resetCount);
  const resetCategory = useMutation(api.athkar.resetCategory);
  const addDhikr = useMutation(api.athkar.addDhikr);
  const ensureDefaultAthkar = useMutation(api.athkar.ensureDefaultAthkar);
  const updateDhikr = useMutation(api.athkar.updateDhikr);
  const deleteDhikr = useMutation(api.athkar.deleteDhikr);

  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingDhikr, setEditingDhikr] = useState<Dhikr | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  const touchStartX = useRef<number | null>(null);
  const seededOnceRef = useRef(false);

  const [newDhikr, setNewDhikr] = useState({ text: "", translation: "", targetCount: 1 });
  const [editForm, setEditForm] = useState({ text: "", translation: "", targetCount: 1, category: "custom" });

  useEffect(() => {
    if (isLoadingAthkar || seededOnceRef.current) return;
    seededOnceRef.current = true;
    ensureDefaultAthkar().catch(() => {});
  }, [isLoadingAthkar, ensureDefaultAthkar]);

  useEffect(() => {
    const today = getLocalDateKey();
    const last = localStorage.getItem("athkar_last_reset_date");
    if (last === today) return;
    localStorage.setItem("athkar_last_reset_date", today);
    const catsToReset = ["morning", "evening", "prayer", "before_sleep", "waking_up"];
    Promise.allSettled(catsToReset.map((c) => resetCategory({ category: c }))).catch(() => {});
  }, [resetCategory]);

  useEffect(() => {
    if (!selectedCategory || selectedCategory === "custom") return;
    const today = getLocalDateKey();
    const list = athkar.filter((d: Dhikr) => d.category === selectedCategory);
    if (!list.length) return;
    const allDone = list.every((d: Dhikr) => (d.currentCount ?? 0) >= (d.targetCount ?? 1));
    if (!allDone) return;
    const dates = readCompletionDates(selectedCategory);
    if (!dates.includes(today)) writeCompletionDates(selectedCategory, [...dates, today]);
  }, [athkar, selectedCategory]);

  useEffect(() => {
    if (!slideDirection) return;
    const id = window.setTimeout(() => setSlideDirection(null), 160);
    return () => window.clearTimeout(id);
  }, [slideDirection, currentIndex]);

  const selectedCategoryDef = categories.find((category) => category.id === selectedCategory) ?? null;

  const categoryData = useMemo(() => {
    return categories.map((category) => {
      const items = athkar.filter((dhikr: Dhikr) => dhikr.category === category.id);
      const completed = items.filter((dhikr) => {
        const count = optimisticCounts[dhikr._id] ?? dhikr.currentCount;
        return count >= dhikr.targetCount;
      }).length;
      const totalTarget = items.reduce((sum, dhikr) => sum + dhikr.targetCount, 0);
      const totalCurrent = items.reduce(
        (sum, dhikr) => sum + Math.min(optimisticCounts[dhikr._id] ?? dhikr.currentCount, dhikr.targetCount),
        0
      );
      const progress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
      return {
        ...category,
        itemCount: items.length,
        completed,
        progress,
        completionDays: category.id === "custom" ? 0 : readCompletionDates(category.id).length,
      };
    });
  }, [athkar, optimisticCounts]);

  const filteredAthkar = useMemo(() => {
    if (!selectedCategory) return [];
    return athkar.filter((dhikr: Dhikr) => dhikr.category === selectedCategory);
  }, [athkar, selectedCategory]);

  useEffect(() => {
    if (currentIndex > Math.max(0, filteredAthkar.length - 1)) setCurrentIndex(0);
  }, [currentIndex, filteredAthkar.length]);

  const currentDhikr = filteredAthkar[currentIndex] ?? null;
  const currentDhikrCount = currentDhikr ? optimisticCounts[currentDhikr._id] ?? currentDhikr.currentCount : 0;

  const handleIncrement = (dhikrId: string) => {
    const dhikr = athkar.find((d: any) => d._id === dhikrId);
    if (!dhikr) return;
    const current = (optimisticCounts[dhikrId] ?? dhikr.currentCount) as number;
    const target = (dhikr.targetCount ?? 1) as number;
    if (current >= target) return;

    const nextCount = Math.min(target, current + 1);
    setOptimisticCounts((m) => ({ ...m, [dhikrId]: nextCount }));

    if (nextCount >= target) play("success", 0.85);
    else play("notification", 0.28);

    incrementCount({ dhikrId: dhikrId as Id<"athkar"> }).catch((err: any) => {
      setOptimisticCounts((m) => {
        const next = { ...m };
        delete next[dhikrId];
        return next;
      });
      toast.error(err?.message ?? "Failed to update");
    });
  };

  const handleReset = async (dhikrId: string) => {
    try {
      setOptimisticCounts((m) => ({ ...m, [dhikrId]: 0 }));
      await resetCount({ dhikrId: dhikrId as Id<"athkar"> });
      toast.success("Counter reset");
    } catch {
      setOptimisticCounts((m) => {
        const next = { ...m };
        delete next[dhikrId];
        return next;
      });
      toast.error("Failed to reset count");
    }
  };

  const goNext = () => {
    if (!filteredAthkar.length || currentIndex >= filteredAthkar.length - 1) return;
    setSlideDirection("next");
    setCurrentIndex((index) => Math.min(filteredAthkar.length - 1, index + 1));
  };

  const goPrevious = () => {
    if (!filteredAthkar.length || currentIndex <= 0) return;
    setSlideDirection("prev");
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX ?? null;
    touchStartX.current = null;
    if (start === null || end === null) return;
    const delta = start - end;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) goNext();
    else goPrevious();
  };

  const openCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentIndex(0);
    setShowAddForm(false);
    setSlideDirection(null);
  };

  const handleAddDhikr = async () => {
    if (!newDhikr.text.trim()) {
      toast.error("Please enter the dhikr text");
      return;
    }
    try {
      await addDhikr({
        text: newDhikr.text.trim(),
        translation: newDhikr.translation.trim() || undefined,
        targetCount: Math.max(1, Number(newDhikr.targetCount) || 1),
        category: "custom",
      });
      setNewDhikr({ text: "", translation: "", targetCount: 1 });
      setShowAddForm(false);
      toast.success("Custom Athkar added");
    } catch {
      toast.error("Failed to add dhikr");
    }
  };

  const startEdit = (dhikr: Dhikr) => {
    setEditForm({
      text: dhikr.text,
      translation: dhikr.translation || "",
      targetCount: dhikr.targetCount,
      category: dhikr.category,
    });
    setEditingDhikr(dhikr);
  };

  const saveEdit = async () => {
    if (!editingDhikr) return;
    if (!editForm.text.trim()) {
      toast.error("Please enter the dhikr text");
      return;
    }
    try {
      await updateDhikr({
        dhikrId: editingDhikr._id as Id<"athkar">,
        text: editForm.text.trim(),
        translation: editForm.translation.trim() || undefined,
        targetCount: Math.max(1, Number(editForm.targetCount) || 1),
        category: editForm.category,
      });
      toast.success("Athkar updated");
      setEditingDhikr(null);
    } catch {
      toast.error("Failed to update dhikr");
    }
  };

  const removeDhikr = async (dhikr: Dhikr) => {
    const ok = window.confirm("Delete this Athkar?");
    if (!ok) return;
    try {
      await deleteDhikr({ dhikrId: dhikr._id as Id<"athkar"> });
      toast.success("Athkar deleted");
      if (currentIndex >= filteredAthkar.length - 1) setCurrentIndex((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Failed to delete dhikr");
    }
  };

  const slideClass =
    slideDirection === "next"
      ? "animate-[athkarSlideRight_160ms_ease-out]"
      : slideDirection === "prev"
        ? "animate-[athkarSlideLeft_160ms_ease-out]"
        : "";

  return (
    <div className={selectedCategory ? "overflow-hidden" : "space-y-6 pb-8"}>
      <style>{`
        @keyframes athkarSlideRight {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes athkarSlideLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes cardTap {
          0% { transform: scale(1); }
          50% { transform: scale(0.985); }
          100% { transform: scale(1); }
        }
      `}</style>

      {!selectedCategory ? (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl ${colors.text}`}>Athkar</h1>
            <p className={`mx-auto mt-3 max-w-2xl text-sm sm:text-base ${colors.textSecondary}`}>
              Choose a category to enter a focused reader.
            </p>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categoryData.map((category) => (
              <button
                key={category.id}
                onClick={() => openCategory(category.id)}
                className={`group relative min-h-[190px] overflow-hidden rounded-[28px] border p-5 text-left transition duration-200 hover:-translate-y-1 active:animate-[cardTap_180ms_ease-out]`}
                style={{
                  background: "linear-gradient(180deg, rgba(3,8,18,0.98) 0%, rgba(2,6,15,0.96) 100%)",
                  borderColor: category.accentStyle,
                  boxShadow: `0 0 0 1px ${category.accentStyle} inset, 0 0 22px ${category.accentStyle}, 0 12px 28px rgba(0,0,0,0.28)`,
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_28%)]" />
                <div className="absolute inset-[1px] rounded-[27px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_34%)]" />
                <div
                  className="absolute inset-x-6 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${category.accentStyle}, transparent)` }}
                />
                <div
                  className="absolute inset-y-7 left-0 w-px"
                  style={{ background: `linear-gradient(180deg, transparent, ${category.accentStyle}, transparent)` }}
                />
                <div
                  className="absolute inset-y-7 right-0 w-px"
                  style={{ background: `linear-gradient(180deg, transparent, ${category.accentStyle}, transparent)` }}
                />
                <div
                  className="absolute inset-x-6 bottom-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${category.accentStyle}, transparent)` }}
                />
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl"
                  style={{ backgroundColor: category.accentStyle }}
                />
                <div className="relative flex h-full flex-col justify-between text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 text-3xl sm:text-4xl opacity-95">{category.icon}</div>
                      <div className="text-xs text-white/45 sm:text-sm">Athkar</div>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {category.name}
                      </h3>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white/80"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: `1px solid ${category.accentStyle}`,
                        boxShadow: `0 0 14px ${category.accentStyle}`,
                      }}
                    >
                      {category.itemCount} items
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="max-w-[24rem] text-sm text-white/70 sm:text-base">
                      {category.description}
                    </p>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-white/60 sm:text-sm">
                        <span>{category.completed} completed</span>
                        <span>{Math.round(category.progress)}%</span>
                      </div>
                      <div className="h-[6px] overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(category.progress, 100)}%`,
                            background: `linear-gradient(90deg, rgba(255,255,255,0.55), ${category.accentStyle})`,
                            boxShadow: `0 0 12px ${category.accentStyle}`,
                          }}
                        />
                      </div>
                    </div>
                    {category.id !== "custom" && (
                      <div className="text-xs font-medium text-white/55 sm:text-sm">
                        {category.completionDays} completed day{category.completionDays === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </section>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`inline-flex items-center gap-2 rounded-2xl border ${colors.border} ${colors.backgroundSecondary} px-4 py-2.5 text-sm ${colors.text} transition hover:bg-white/5`}
            >
              <span>←</span>
              <span>Back</span>
            </button>
            {selectedCategoryDef && (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                {selectedCategoryDef.name}
              </div>
            )}
          </div>

          {currentDhikr ? (
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="overflow-hidden rounded-[22px] border border-white/10 bg-black"
            >
              <div className={`shrink-0 bg-gradient-to-r ${selectedCategoryDef?.accentClass ?? "from-emerald-500 to-green-700"} px-4 py-3 sm:px-5`}>
                <div className="flex items-center justify-between text-white">
                  <button
                    onClick={goPrevious}
                    disabled={currentIndex === 0}
                    className="rounded-full bg-black/15 px-3 py-2 text-sm transition hover:bg-black/25 disabled:opacity-40"
                    aria-label="Previous"
                  >
                    ←
                  </button>
                  <div className="text-lg font-medium">{selectedCategoryDef?.name}</div>
                  <button
                    onClick={goNext}
                    disabled={currentIndex >= filteredAthkar.length - 1}
                    className="rounded-full bg-black/15 px-3 py-2 text-sm transition hover:bg-black/25 disabled:opacity-40"
                    aria-label="Next"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="shrink-0 bg-[#1f1f1f] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-[54px] text-white text-[1.05rem] font-medium">
                    {currentDhikr.targetCount}/{Math.max(1, currentDhikrCount)}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#4b4b4b]">
                    <div
                      className="h-full rounded-full bg-[#63b43b] transition-all duration-300"
                      style={{ width: `${((currentDhikrCount / currentDhikr.targetCount) * 100) || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 sm:px-7">
                <div className={`h-[46vh] min-h-[280px] max-h-[430px] overflow-y-auto ${slideClass}`}>
                  <div className="mx-auto flex min-h-full max-w-[620px] items-start justify-center py-2">
                    <div className="w-full">
                      <div
                        dir="rtl"
                        className="mx-auto text-right text-[1.75rem] leading-[1.85] text-white sm:text-[2.05rem] lg:text-[2.3rem]"
                      >
                        {currentDhikr.text}
                      </div>
                      {currentDhikr.translation && (
                        <p className="mt-8 text-center text-sm leading-7 text-white/60 sm:text-base">
                          {currentDhikr.translation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-4 sm:px-7">
                <div className="mb-4 flex items-center justify-between text-[#63b43b]">
                  <button
                    type="button"
                    className="rounded-full p-2 transition hover:bg-white/5"
                    aria-label="Share"
                  >
                    ↗
                  </button>
                  <div className="text-base font-semibold">
                    {Math.max(0, currentDhikr.targetCount - currentDhikrCount) === 0
                      ? "Completed"
                      : `${Math.max(0, currentDhikr.targetCount - currentDhikrCount)} left`}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (currentDhikrCount < currentDhikr.targetCount) {
                      handleIncrement(currentDhikr._id);
                    } else {
                      goNext();
                    }
                  }}
                  className="w-full rounded-xl bg-[#5d980b] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#6aa812]"
                >
                  {currentDhikrCount < currentDhikr.targetCount
                    ? "Count"
                    : currentIndex < filteredAthkar.length - 1
                      ? "Next"
                      : "Done"}
                </button>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/45">
                  <button onClick={() => handleReset(currentDhikr._id)} className="rounded-lg px-2 py-1 transition hover:bg-white/5">
                    Reset
                  </button>
                  <div>{currentIndex + 1} of {filteredAthkar.length}</div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(currentDhikr)} className="rounded-lg px-2 py-1 transition hover:bg-white/5">Edit</button>
                    <button onClick={() => removeDhikr(currentDhikr)} className="rounded-lg px-2 py-1 text-red-300 transition hover:bg-red-500/10">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${colors.backgroundSecondary} ${colors.border} rounded-[28px] border p-8 text-center`}>
              <div className="text-5xl">📿</div>
              <h3 className={`mt-4 text-xl font-semibold ${colors.text}`}>No Athkar found</h3>
              <p className={`mt-2 text-sm ${colors.textSecondary}`}>
                {selectedCategory === "custom" ? "Add your first custom Athkar below." : "This category does not have any entries yet."}
              </p>
            </div>
          )}

          {selectedCategory === "custom" && (
            <div className={`${colors.backgroundSecondary} ${colors.border} mt-4 rounded-[28px] border p-4 sm:p-6`}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text}`}>Manage custom Athkar</h3>
                  <p className={`mt-1 text-sm ${colors.textSecondary}`}>Create and edit your own personal list.</p>
                </div>
                <button onClick={() => setShowAddForm((value) => !value)} className={`rounded-2xl bg-gradient-to-r ${selectedCategoryDef?.accentClass ?? "from-amber-400 to-orange-600"} px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95`}>
                  {showAddForm ? "Close form" : "Add custom Athkar"}
                </button>
              </div>

              {showAddForm && (
                <div className="grid gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Arabic text</label>
                    <textarea dir="rtl" rows={4} value={newDhikr.text} onChange={(e) => setNewDhikr((prev) => ({ ...prev, text: e.target.value }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4 text-right`} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Translation</label>
                    <input value={newDhikr.translation} onChange={(e) => setNewDhikr((prev) => ({ ...prev, translation: e.target.value }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4`} />
                  </div>
                  <div>
                    <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Target count</label>
                    <input type="number" min="1" max="1000" value={newDhikr.targetCount} onChange={(e) => setNewDhikr((prev) => ({ ...prev, targetCount: parseInt(e.target.value) || 1 }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4`} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleAddDhikr} className={`w-full rounded-2xl bg-gradient-to-r ${selectedCategoryDef?.accentClass ?? "from-amber-400 to-orange-600"} px-4 py-4 font-semibold text-white transition hover:opacity-95`}>Save custom Athkar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editingDhikr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingDhikr(null)} />
          <div className={`${colors.backgroundSecondary} ${colors.border} relative z-10 w-full max-w-2xl rounded-[28px] border p-5 sm:p-6`}>
            <h3 className={`text-xl font-semibold ${colors.text}`}>Edit Athkar</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Arabic text</label>
                <textarea dir="rtl" rows={4} value={editForm.text} onChange={(e) => setEditForm((prev) => ({ ...prev, text: e.target.value }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4 text-right`} />
              </div>
              <div className="sm:col-span-2">
                <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Translation</label>
                <input value={editForm.translation} onChange={(e) => setEditForm((prev) => ({ ...prev, translation: e.target.value }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4`} />
              </div>
              <div>
                <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Target count</label>
                <input type="number" min="1" max="1000" value={editForm.targetCount} onChange={(e) => setEditForm((prev) => ({ ...prev, targetCount: parseInt(e.target.value) || 1 }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4`} />
              </div>
              <div>
                <label className={`mb-2 block text-sm ${colors.textSecondary}`}>Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))} className={`w-full rounded-2xl border ${colors.border} ${colors.backgroundTertiary} ${colors.text} p-4`}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditingDhikr(null)} className={`flex-1 rounded-2xl border ${colors.border} px-4 py-4 ${colors.textSecondary} transition hover:bg-white/5`}>Cancel</button>
              <button onClick={saveEdit} className={`flex-1 rounded-2xl bg-gradient-to-r ${selectedCategoryDef?.accentClass ?? "from-emerald-500 to-green-700"} px-4 py-4 font-semibold text-white transition hover:opacity-95`}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
