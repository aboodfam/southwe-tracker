import { usePrayerTimes } from "../hooks/usePrayerTimes";
import { currentPrayerSessionKey, prayerSessionName, PRAYER_NAMES } from "../lib/prayerSessions";
import { ChoiceSelect } from "./ChoiceSelect";
import { athkarSwipeNavigation, type PageMotion } from "../lib/navigation";
import { useAthkarWindows } from "../hooks/useAthkarWindows";
import type { ScheduledAthkarCategory } from "../lib/athkarSchedule";
import { t as tr, useLocale } from "../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useSound } from "../contexts/SoundContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalDateKey } from "../hooks/useLocalDateKey";
import { Icon, IconName } from "./icons";
import { PageHeader } from "./PageHeader";

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
  shortName: string;
  icon: IconName;
  description: string;
};

const categories: CategoryDef[] = [
  { id: "morning", get name() { return tr("Morning Athkar"); }, get shortName() { return tr("Morning"); }, icon: "sun", get description() { return tr("Start the day with remembrance and protection."); } },
  { id: "evening", get name() { return tr("Evening Athkar"); }, get shortName() { return tr("Evening"); }, icon: "moon", get description() { return tr("Close the day with calm and reflection."); } },
  { id: "before_sleep", get name() { return tr("Before Sleep"); }, get shortName() { return tr("Sleep"); }, icon: "bed", get description() { return tr("End the day with peace, remembrance, and trust."); } },
  { id: "prayer", get name() { return tr("After Prayer"); }, get shortName() { return tr("Prayer"); }, icon: "hands", get description() { return tr("Keep each prayer connected to remembrance."); } },
  { id: "waking_up", get name() { return tr("Upon Waking"); }, get shortName() { return tr("Wake"); }, icon: "sunrise", get description() { return tr("Begin your first moments with gratitude."); } },
  { id: "custom", get name() { return tr("Custom Dhikr"); }, get shortName() { return tr("Custom"); }, icon: "sparkles", get description() { return tr("Build a personal remembrance list of your own."); } },
];

const SCHEDULED_CATEGORY_IDS = new Set(["morning", "evening", "before_sleep", "waking_up"]);
const OPEN_CATEGORY_KEY = "ceventic_athkar_open_category";
const PRAYER_SESSION_KEY = "ceventic_athkar_prayer_session";

function readPendingCategory() {
  try {
    const value = sessionStorage.getItem(OPEN_CATEGORY_KEY);
    sessionStorage.removeItem(OPEN_CATEGORY_KEY);
    return value && categories.some((category) => category.id === value) ? value : null;
  } catch {
    return null;
  }
}

function readPendingPrayerSession() {
  try {
    const value = sessionStorage.getItem(PRAYER_SESSION_KEY);
    sessionStorage.removeItem(PRAYER_SESSION_KEY);
    return value && /^prayer:\d{4}-\d{2}-\d{2}:(fajr|dhuhr|asr|maghrib|isha)$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function readSavedCustomIndex(category: string) {
  try {
    const value = Number(localStorage.getItem(`athkar_last_index_${category}`));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveCustomIndex(category: string, index: number) {
  try {
    localStorage.setItem(`athkar_last_index_${category}`, String(index));
  } catch {}
}

function completionStorageKey(category: string) {
  return `athkar_completed_dates_${category}`;
}

function readCompletionDates(category: string): string[] {
  try {
    const raw = localStorage.getItem(completionStorageKey(category));
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeCompletionDates(category: string, dates: string[]) {
  try {
    localStorage.setItem(completionStorageKey(category), JSON.stringify(dates));
  } catch {}
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function AthkarPage({ prefetchedAthkar, onFocusModeChange }: { prefetchedAthkar?: Dhikr[]; onFocusModeChange?: (focused: boolean) => void }) {
  useLocale();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { play } = useSound();
  const dateKey = useLocalDateKey();
  const windows = useAthkarWindows();
  const prayerClock = usePrayerTimes(true);
  const defaultPrayerKey = currentPrayerSessionKey(prayerClock.now, prayerClock.timings);
  const windowSignature = Object.values(windows).join("|");
  const [preparedWindows, setPreparedWindows] = useState<Record<string, string>>({});
  const [prepareError, setPrepareError] = useState(false);
  const [retry, setRetry] = useState(0);


  const athkarRaw = prefetchedAthkar;
  const athkar = athkarRaw ?? [];
  const isLoading = athkarRaw === undefined;

  const incrementCount = useMutation(api.athkar.incrementCount);
  const resetCount = useMutation(api.athkar.resetCount);
  const addDhikr = useMutation(api.athkar.addDhikr);
  const ensureDefaultAthkar = useMutation(api.athkar.ensureDefaultAthkar);
  const updateDhikr = useMutation(api.athkar.updateDhikr);
  const deleteDhikr = useMutation(api.athkar.deleteDhikr);
  const prepareCategorySession = useMutation(api.athkar.prepareCategorySession);
  const saveCategoryIndex = useMutation(api.athkar.saveCategoryIndex);
  const markCategoryCompleted = useMutation(api.athkar.markCategoryCompleted);
  const ensurePrayerSession = useMutation(api.athkar.ensurePrayerSession);
  const incrementPrayerSession = useMutation(api.athkar.incrementPrayerSession);
  const savePrayerIndex = useMutation(api.athkar.savePrayerIndex);
  const resetPrayerDhikr = useMutation(api.athkar.resetPrayerDhikr);

  const initialCategoryRef = useRef<string | null>(readPendingCategory());
  const initialPrayerSessionRef = useRef(readPendingPrayerSession());
  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number>>({});
  const [optimisticPrayerCounts, setOptimisticPrayerCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategoryRef.current);
  const [prayerChoice, setPrayerChoice] = useState<{dateKey: string; key: string; occurrenceKey: string} | null>(() => initialPrayerSessionRef.current && (initialPrayerSessionRef.current.split(":")[1] === dateKey || initialPrayerSessionRef.current === defaultPrayerKey) ? {dateKey, key: initialPrayerSessionRef.current, occurrenceKey: defaultPrayerKey} : null);
  const prayerSessionKey = prayerChoice?.dateKey === dateKey && prayerChoice.occurrenceKey === defaultPrayerKey ? prayerChoice.key : defaultPrayerKey;
  const selectedWindowKey = selectedCategory === "prayer" ? prayerSessionKey.split(":")[1] : windows[selectedCategory as ScheduledAthkarCategory] ?? dateKey;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [positionReady, setPositionReady] = useState(false);
  const [editingDhikr, setEditingDhikr] = useState<Dhikr | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [slideDirection, setSlideDirection] = useState<PageMotion | null>(null);
  const [newDhikr, setNewDhikr] = useState({ text: "", translation: "", targetCount: 1 });
  const [editForm, setEditForm] = useState({ text: "", translation: "", targetCount: 1, category: "custom" });
  const touchStart = useRef<{x: number; y: number} | null>(null);
  const seededOnceRef = useRef(false);
  const preparedSessionRef = useRef("");

  const prayerSession = useQuery(
    api.athkar.getPrayerSession,
    selectedCategory === "prayer" ? { sessionKey: prayerSessionKey } : "skip",
  );
  const cardPrayerSession = useQuery(api.athkar.getPrayerSession, { sessionKey: prayerSessionKey });

  useEffect(() => {
    if (isLoading || seededOnceRef.current) return;
    seededOnceRef.current = true;
    ensureDefaultAthkar().catch(() => {});
  }, [isLoading, ensureDefaultAthkar]);

  useEffect(() => {
    onFocusModeChange?.(selectedCategory !== null);
  }, [selectedCategory, onFocusModeChange]);

  useEffect(() => () => onFocusModeChange?.(false), [onFocusModeChange]);

  const selectedPrayerCounts = useMemo(
    () => new Map((prayerSession?.counts ?? []).map((row) => [String(row.dhikrId), row.count])),
    [prayerSession?.counts],
  );
  const manualPrayerCounts = useMemo(
    () => new Map((cardPrayerSession?.counts ?? []).map((row) => [String(row.dhikrId), row.count])),
    [cardPrayerSession?.counts],
  );

  // Prepare every card, not just the category the user opens. The server does
  // the reset atomically and repeated calls in the same window preserve progress.
  useEffect(() => {
    if (isLoading) return;
    let canceled = false;
    setPrepareError(false);
    setOptimisticCounts({});
    for (const [category, windowKey] of Object.entries(windows)) {
      void prepareCategorySession({ category, windowKey }).then(() => {
        if (!canceled) setPreparedWindows(current => ({ ...current, [category]: windowKey }));
      }).catch(() => { if (!canceled) setPrepareError(true); });
    }
    return () => { canceled = true; };
  }, [isLoading, windowSignature, retry, prepareCategorySession]);

  const countFor = (dhikr: Dhikr) => {
    if (SCHEDULED_CATEGORY_IDS.has(dhikr.category) && preparedWindows[dhikr.category] !== windows[dhikr.category as ScheduledAthkarCategory]) return 0;
    if (dhikr.category === "prayer") {
      const stored = selectedCategory === "prayer"
        ? selectedPrayerCounts.get(String(dhikr._id)) ?? 0
        : manualPrayerCounts.get(String(dhikr._id)) ?? 0;
      return selectedCategory === "prayer"
        ? (positionReady && preparedSessionRef.current === `prayer:${prayerSessionKey}` ? optimisticPrayerCounts[dhikr._id] : undefined) ?? stored
        : stored;
    }
    return optimisticCounts[dhikr._id] ?? dhikr.currentCount;
  };

  const categoryData = categories.map((category) => {
    const items = athkar.filter((dhikr: Dhikr) => dhikr.category === category.id);
    const totalTarget = items.reduce((sum, dhikr) => sum + Math.max(1, dhikr.targetCount), 0);
    const totalCurrent = items.reduce((sum, dhikr) => sum + Math.min(countFor(dhikr), Math.max(1, dhikr.targetCount)), 0);
    const completed = items.filter((dhikr) => countFor(dhikr) >= dhikr.targetCount).length;
    return {
      ...category,
      itemCount: items.length,
      completed,
      progress: totalTarget ? (totalCurrent / totalTarget) * 100 : 0,
      completionDays: category.id === "custom" ? 0 : readCompletionDates(category.id).length,
    };
  });

  const totalTarget = athkar.reduce((sum: number, dhikr: Dhikr) => sum + Math.max(1, dhikr.targetCount), 0);
  const totalCurrent = athkar.reduce((sum: number, dhikr: Dhikr) => sum + Math.min(countFor(dhikr), Math.max(1, dhikr.targetCount)), 0);
  const overall = {
    progress: totalTarget ? (totalCurrent / totalTarget) * 100 : 0,
    completedItems: athkar.filter((dhikr: Dhikr) => countFor(dhikr) >= dhikr.targetCount).length,
    totalItems: athkar.length,
  };

  const filteredAthkar = useMemo(
    () => (selectedCategory ? athkar.filter((dhikr: Dhikr) => dhikr.category === selectedCategory) : []),
    [athkar, selectedCategory]
  );

  const selectedCategoryDef = categories.find((category) => category.id === selectedCategory) ?? null;
  const prayerName = prayerSessionName(prayerSessionKey);
  const selectedCategoryTitle = selectedCategory === "prayer" && prayerName
    ? tr("After {0} Prayer", {0: tr(prayerName.charAt(0).toUpperCase()+prayerName.slice(1))})
    : selectedCategoryDef?.name ?? tr("Athkar");
  const currentDhikr = filteredAthkar[currentIndex] ?? null;
  const currentDhikrCount = currentDhikr ? countFor(currentDhikr) : 0;

  useEffect(() => {
    if (!selectedCategory || isLoading) {
      setPositionReady(false);
      return;
    }
    const sessionIdentity = selectedCategory === "prayer"
      ? `${selectedCategory}:${prayerSessionKey}`
      : SCHEDULED_CATEGORY_IDS.has(selectedCategory)
        ? `${selectedCategory}:${selectedWindowKey}`
        : selectedCategory;
    if (preparedSessionRef.current === sessionIdentity) return;
    preparedSessionRef.current = sessionIdentity;
    setPositionReady(false);
    setOptimisticPrayerCounts({});

    const maxIndex = Math.max(0, athkar.filter((dhikr) => dhikr.category === selectedCategory).length - 1);
    const clampIndex = (index: number) => Math.max(0, Math.min(maxIndex, index));

    if (selectedCategory === "prayer") {
      if (prayerClock.status === "idle" || prayerClock.status === "loading") { preparedSessionRef.current = ""; return; }
      void ensurePrayerSession({ sessionKey: prayerSessionKey })
        .then((session) => {
          if (preparedSessionRef.current !== sessionIdentity) return;
          setCurrentIndex(clampIndex(session?.currentIndex ?? 0));
          setPositionReady(true);
        })
        .catch(() => {
          if (preparedSessionRef.current !== sessionIdentity) return;
          preparedSessionRef.current = "";
          setPrepareError(true);
        });
      return;
    }

    if (SCHEDULED_CATEGORY_IDS.has(selectedCategory)) {
      void prepareCategorySession({ category: selectedCategory, windowKey: selectedWindowKey })
        .then((session) => {
          if (preparedSessionRef.current !== sessionIdentity) return;
          setPreparedWindows(current => ({ ...current, [selectedCategory]: selectedWindowKey }));
          const items = athkar.filter((dhikr) => dhikr.category === selectedCategory);
          const firstIncomplete = items.findIndex((dhikr) => dhikr.currentCount < dhikr.targetCount);
          const fallback = firstIncomplete === -1 ? Math.max(0, items.length - 1) : firstIncomplete;
          setCurrentIndex(clampIndex(session?.currentIndex ?? fallback));
          setPositionReady(true);
        })
        .catch(() => {
          const items = athkar.filter((dhikr) => dhikr.category === selectedCategory);
          const firstIncomplete = items.findIndex((dhikr) => dhikr.currentCount < dhikr.targetCount);
          setCurrentIndex(clampIndex(firstIncomplete === -1 ? Math.max(0, items.length - 1) : firstIncomplete));
          setPositionReady(true);
        });
      return;
    }

    setCurrentIndex(clampIndex(readSavedCustomIndex(selectedCategory)));
    setPositionReady(true);
  }, [selectedCategory, prayerSessionKey, selectedWindowKey, isLoading, athkar, retry, prayerClock.status, ensurePrayerSession, prepareCategorySession]);

  useEffect(() => {
    if (!selectedCategory || !positionReady) return;
    if (selectedCategory === "prayer") {
      void savePrayerIndex({ sessionKey: prayerSessionKey, currentIndex }).catch(() => {});
      return;
    }
    if (SCHEDULED_CATEGORY_IDS.has(selectedCategory)) {
      if (preparedWindows[selectedCategory] !== selectedWindowKey) return;
      void saveCategoryIndex({ category: selectedCategory, currentIndex }).catch(() => {});
      return;
    }
    saveCustomIndex(selectedCategory, currentIndex);
  }, [selectedCategory, prayerSessionKey, currentIndex, positionReady, preparedWindows, selectedWindowKey, savePrayerIndex, saveCategoryIndex]);

  useEffect(() => {
    if (!selectedCategory || selectedCategory === "custom" || !positionReady) return;
    if (SCHEDULED_CATEGORY_IDS.has(selectedCategory) && preparedWindows[selectedCategory] !== selectedWindowKey) return;
    const items = athkar.filter((dhikr: Dhikr) => dhikr.category === selectedCategory);
    if (!items.length || !items.every((dhikr) => countFor(dhikr) >= dhikr.targetCount)) return;
    const dates = readCompletionDates(selectedCategory);
    if (!dates.includes(selectedWindowKey)) writeCompletionDates(selectedCategory, [...dates, selectedWindowKey]);
    if (SCHEDULED_CATEGORY_IDS.has(selectedCategory)) {
      void markCategoryCompleted({ category: selectedCategory, windowKey: selectedWindowKey }).catch(() => {});
    }
  }, [athkar, optimisticCounts, optimisticPrayerCounts, prayerSession?.counts, selectedCategory, selectedWindowKey, preparedWindows, positionReady, markCategoryCompleted]);

  useEffect(() => {
    if (currentIndex > Math.max(0, filteredAthkar.length - 1)) setCurrentIndex(0);
  }, [currentIndex, filteredAthkar.length]);

  useEffect(() => {
    if (!slideDirection) return;
    const timeout = window.setTimeout(() => setSlideDirection(null), 320);
    return () => window.clearTimeout(timeout);
  }, [slideDirection, currentIndex]);

  const openCategory = (categoryId: string) => {
    preparedSessionRef.current = "";
    setPositionReady(false);
    setOptimisticPrayerCounts({});
    setSelectedCategory(categoryId);
    setCurrentIndex(0);
    setShowAddForm(false);
    setSlideDirection(null);
  };

  const closeCategory = () => {
    preparedSessionRef.current = "";
    setPositionReady(false);
    setSelectedCategory(null);
    setSlideDirection(null);
  };

  const goNext = (motion?: PageMotion) => {
    if (currentIndex >= filteredAthkar.length - 1) return;
    setSlideDirection(motion ?? "right");
    setCurrentIndex((index) => index + 1);
  };

  const goPrevious = (motion?: PageMotion) => {
    if (currentIndex <= 0) return;
    setSlideDirection(motion ?? "left");
    setCurrentIndex((index) => index - 1);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const point = event.touches[0];
    touchStart.current = point ? { x: point.clientX, y: point.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const end = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const swipe = athkarSwipeNavigation(dx);
    if (swipe.next) goNext(swipe.motion);
    else goPrevious(swipe.motion);
  };

  const handleIncrement = (dhikrId: string) => {
    const dhikr = athkar.find((item: Dhikr) => item._id === dhikrId);
    if (!dhikr) return;
    if (SCHEDULED_CATEGORY_IDS.has(dhikr.category) && preparedWindows[dhikr.category] !== windows[dhikr.category as ScheduledAthkarCategory]) return;
    const current = countFor(dhikr);
    if (current >= dhikr.targetCount) return;
    const next = Math.min(dhikr.targetCount, current + 1);
    play(next >= dhikr.targetCount ? "success" : "notification", next >= dhikr.targetCount ? 0.85 : 0.25);

    if (dhikr.category === "prayer" && selectedCategory === "prayer") {
      if (!positionReady || preparedSessionRef.current !== `prayer:${prayerSessionKey}`) return;
      setOptimisticPrayerCounts((state) => ({ ...state, [dhikrId]: next }));
      incrementPrayerSession({ sessionKey: prayerSessionKey, dhikrId: dhikrId as Id<"athkar"> }).catch((error: any) => {
        setOptimisticPrayerCounts((state) => {
          const nextState = { ...state };
          delete nextState[dhikrId];
          return nextState;
        });
        toast.error(error?.message ?? tr("Failed to update"));
      });
      return;
    }

    setOptimisticCounts((state) => ({ ...state, [dhikrId]: next }));
    incrementCount({ dhikrId: dhikrId as Id<"athkar"> }).catch((error: any) => {
      setOptimisticCounts((state) => {
        const nextState = { ...state };
        delete nextState[dhikrId];
        return nextState;
      });
      toast.error(error?.message ?? tr("Failed to update"));
    });
  };

  const handleReset = async (dhikrId: string) => {
    const dhikr = athkar.find((item: Dhikr) => item._id === dhikrId);
    if (!dhikr) return;
    if (dhikr.category === "prayer" && selectedCategory === "prayer") {
      if (!positionReady || preparedSessionRef.current !== `prayer:${prayerSessionKey}`) return;
      setOptimisticPrayerCounts((state) => ({ ...state, [dhikrId]: 0 }));
      try {
        await resetPrayerDhikr({ sessionKey: prayerSessionKey, dhikrId: dhikrId as Id<"athkar"> });
        toast.success(tr("Counter reset"));
      } catch {
        setOptimisticPrayerCounts((state) => {
          const nextState = { ...state };
          delete nextState[dhikrId];
          return nextState;
        });
        toast.error(tr("Failed to reset count"));
      }
      return;
    }

    setOptimisticCounts((state) => ({ ...state, [dhikrId]: 0 }));
    try {
      await resetCount({ dhikrId: dhikrId as Id<"athkar"> });
      toast.success(tr("Counter reset"));
    } catch {
      setOptimisticCounts((state) => {
        const nextState = { ...state };
        delete nextState[dhikrId];
        return nextState;
      });
      toast.error(tr("Failed to reset count"));
    }
  };

  const handleAddDhikr = async () => {
    if (!newDhikr.text.trim()) return toast.error(tr("Please enter the dhikr text"));
    try {
      await addDhikr({
        text: newDhikr.text.trim(),
        translation: newDhikr.translation.trim() || undefined,
        targetCount: Math.max(1, Number(newDhikr.targetCount) || 1),
        category: "custom",
      });
      setNewDhikr({ text: "", translation: "", targetCount: 1 });
      setShowAddForm(false);
      toast.success(tr("Custom Athkar added"));
    } catch {
      toast.error(tr("Failed to add dhikr"));
    }
  };

  const startEdit = (dhikr: Dhikr) => {
    setEditForm({ text: dhikr.text, translation: dhikr.translation || "", targetCount: dhikr.targetCount, category: dhikr.category });
    setEditingDhikr(dhikr);
  };

  const saveEdit = async () => {
    if (!editingDhikr || !editForm.text.trim()) return;
    try {
      await updateDhikr({
        dhikrId: editingDhikr._id as Id<"athkar">,
        text: editForm.text.trim(),
        translation: editForm.translation.trim() || undefined,
        targetCount: Math.max(1, Number(editForm.targetCount) || 1),
        category: editForm.category,
      });
      setEditingDhikr(null);
      toast.success(tr("Athkar updated"));
    } catch {
      toast.error(tr("Failed to update dhikr"));
    }
  };

  const removeDhikr = async (dhikr: Dhikr) => {
    if (!window.confirm(tr("Delete this Athkar?"))) return;
    try {
      await deleteDhikr({ dhikrId: dhikr._id as Id<"athkar"> });
      if (currentIndex >= filteredAthkar.length - 1) setCurrentIndex((value) => Math.max(0, value - 1));
      toast.success(tr("Athkar deleted"));
    } catch {
      toast.error(tr("Failed to delete dhikr"));
    }
  };

  const slideClass = slideDirection ? `sw-page-swap-${slideDirection}` : "";

  return (
    <div className="space-y-6 sm:space-y-8">
{prepareError && <div role="alert" className="col-span-full rounded-xl border border-amber-300/20 p-3 text-sm text-amber-100">{tr("Could not load Adhkar. Check your connection and try again.")} <button className="min-h-11 px-2 underline" onClick={() => { preparedSessionRef.current = ""; setRetry(value => value + 1); }}>{tr("Try again")}</button></div>}
      {!selectedCategory ? (
        <>
          <PageHeader title={tr("Athkar")} subtitle={tr("Daily remembrance, organized and easy to complete.")} />

          <section
            className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl sm:p-5 animate-float-in"
            style={{ ["--delay" as any]: "70ms" }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: tr("Today"), value: `${Math.round(overall.progress)}%`, sub: tr("overall progress"), icon: "progress" as IconName },
                { label: tr("Completed"), value: `${overall.completedItems}/${overall.totalItems}`, sub: tr("Athkar items"), icon: "checkCircle" as IconName },
                { label: tr("Categories"), value: String(categories.length), sub: tr("organized sections"), icon: "layers" as IconName },
              ].map((stat) => (
                <div key={stat.label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[image:var(--sw-gradient)] opacity-[0.07] blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">{stat.label}</div>
                      <div className="mt-1 text-2xl font-black text-white">{stat.value}</div>
                      <div className="mt-1 text-xs text-white/45">{stat.sub}</div>
                    </div>
                    <div className={`grid h-10 w-10 place-items-center rounded-xl border ${colors.border} bg-white/[0.035]`}>
                      <Icon name={stat.icon} className={`h-4.5 w-4.5 ${colors.text}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-700" style={{ width: `${clampPercent(overall.progress)}%` }} />
            </div>
          </section>

          <section className="mx-auto max-w-6xl animate-float-in" style={{ ["--delay" as any]: "130ms" }}>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">{tr("Choose a section")}</h2>
                <p className="mt-1 text-sm text-white/45">{tr("Open one category and work through it without distractions.")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categoryData.map((category) => (
                <button
                  key={category.id}
                  onClick={() => openCategory(category.id)}
                  className={`group relative overflow-hidden rounded-2xl border ${colors.border} ${colors.backgroundSecondary} p-4 text-start backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 sm:p-5`}
                  style={{ boxShadow: "0 16px 50px rgba(0,0,0,.18)" }}
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[image:var(--sw-gradient)] opacity-[0.06] blur-3xl transition-opacity group-hover:opacity-[0.1]" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl border ${colors.border} bg-white/[0.035]`}>
                        <Icon name={category.icon} className={`h-5 w-5 ${colors.text}`} />
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white/50">{tr("Adhkar: {0}", {0: category.itemCount})}</div>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-white">{category.name}</h3>
                    <p className="mt-1.5 min-h-[40px] text-sm leading-5 text-white/50">{category.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-white/45">
                      <span>{tr("Completed: {0} of {1}", {0: category.completed, 1: category.itemCount})}</span>
                      <span className={colors.text}>{Math.round(category.progress)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-500" style={{ width: `${clampPercent(category.progress)}%` }} />
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3">
                      <span className="text-xs text-white/40">{category.id === "custom" ? tr("Personal list") : tr(category.completionDays === 1 ? "{0} completed day" : "{0} completed days", {0: category.completionDays})}</span>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${colors.text}`}>{tr("Open")} <Icon name="chevronRight" className="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="mx-auto max-w-5xl space-y-5 athkar-focus-view">
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/95 px-3 py-3 sm:hidden">
            <button onClick={closeCategory} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70" aria-label={tr("Back to Athkar sections")}>
              <Icon name="chevronLeft" className="h-5 w-5" />
            </button>
            <div className="min-w-0 px-3 text-center">
              <div className="truncate text-base font-bold text-white">{selectedCategoryTitle}</div>
              <div className="mt-0.5 text-[11px] text-white/40">{filteredAthkar.length} {tr("items")}</div>
            </div>
            <div className="h-11 w-11" />
          </div>

          <div className="hidden sm:block">
            <PageHeader title={selectedCategoryTitle} subtitle={selectedCategoryDef?.description ?? tr("Focused remembrance.")} />
          </div>

          <div className="hidden items-center justify-between gap-3 sm:flex">
            <button onClick={closeCategory} className={`inline-flex items-center gap-2 rounded-xl border ${colors.border} bg-black/30 px-3 py-2 text-sm ${colors.textSecondary} backdrop-blur-xl transition hover:bg-white/[0.05] hover:text-white`}>
              <Icon name="chevronLeft" className="h-4 w-4" /> {tr("Back to sections")} </button>
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/45 backdrop-blur-xl">{filteredAthkar.length} {tr("items")}</div>
          </div>

          {selectedCategory === "prayer" && <div className="px-4 sm:px-0"><ChoiceSelect label={tr("Prayer session")} value={prayerSessionKey} className="w-full sm:w-64" onChange={key => {preparedSessionRef.current = ""; setPositionReady(false); setPrayerChoice({dateKey, key, occurrenceKey: defaultPrayerKey});}} options={[
            ...(!PRAYER_NAMES.some(name => `prayer:${dateKey}:${name.toLowerCase()}` === defaultPrayerKey) ? [{value: defaultPrayerKey, label: prayerSessionName(defaultPrayerKey) ? tr("Previous Isha") : tr("Today")}] : []),
            ...PRAYER_NAMES.map(name => ({value: `prayer:${dateKey}:${name.toLowerCase()}`, label: tr(name)})),
          ]} /><p className="mt-2 text-xs text-white/45">{tr("Each prayer has its own counters. Progress resumes within the same prayer.")}</p></div>}

          {!positionReady ? (
            <div className={`rounded-3xl border ${colors.border} ${colors.backgroundSecondary} p-8 text-center text-sm text-white/55 backdrop-blur-xl`}>
              {tr("Getting your Athkar ready…")} </div>
          ) : currentDhikr ? (
            <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`relative overflow-hidden border-y border-white/[0.08] bg-black sm:rounded-3xl sm:border ${colors.border} sm:bg-[rgb(var(--sw-surface-rgb)/.92)] sm:backdrop-blur-xl`}>
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[image:var(--sw-gradient)] opacity-[0.06] blur-3xl" />

              <div className="relative border-b border-white/[0.08] px-4 py-3 sm:p-5">
                <div className="flex flex-row-reverse items-center justify-between gap-3">
                  <button onClick={() => goPrevious()} disabled={currentIndex === 0} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label={tr("Previous Athkar")}>
                    <Icon name="chevronRight" className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-white/35">{tr("Item")} {currentIndex + 1} {tr("of")} {filteredAthkar.length}</div>
                    <div className="mt-1 text-sm font-semibold text-white/75">{selectedCategoryDef?.shortName}</div>
                  </div>
                  <button onClick={() => goNext()} disabled={currentIndex >= filteredAthkar.length - 1} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-25" aria-label={tr("Next Athkar")}>
                    <Icon name="chevronLeft" className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="min-w-[68px] text-sm font-bold text-white">{currentDhikrCount}/{currentDhikr.targetCount}</div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-all duration-300" style={{ width: `${clampPercent((currentDhikrCount / Math.max(1, currentDhikr.targetCount)) * 100)}%` }} />
                  </div>
                  <div className={`min-w-[52px] text-right text-xs font-semibold ${colors.text}`}>{Math.round(clampPercent((currentDhikrCount / Math.max(1, currentDhikr.targetCount)) * 100))}%</div>
                </div>
              </div>

              <div key={currentIndex} className={`relative px-5 py-8 sm:px-8 sm:py-10 ${slideClass}`}>
                <div className="mx-auto min-h-[42vh] max-w-3xl sm:min-h-[300px]">
                  <div dir="rtl" className="athkar-arabic-text text-right text-white sm:text-[2rem] sm:leading-[2.05] lg:text-[2.2rem]">{currentDhikr.text}</div>
                  {currentDhikr.translation && <p dir="auto" className="mt-8 border-t border-white/[0.07] pt-5 text-center text-sm leading-7 text-white/50 sm:text-base">{currentDhikr.translation}</p>}
                </div>
              </div>

              <div className="sticky bottom-0 z-30 border-t border-white/[0.08] bg-black/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:relative sm:bg-transparent sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-white/40">{Math.max(0, currentDhikr.targetCount - currentDhikrCount)} {tr("remaining")}</span>
                  <span className={`font-semibold ${currentDhikrCount >= currentDhikr.targetCount ? colors.text : "text-white/50"}`}>{currentDhikrCount >= currentDhikr.targetCount ? tr("Completed") : tr("In progress")}</span>
                </div>

                <button
                  onClick={() => currentDhikrCount < currentDhikr.targetCount ? handleIncrement(currentDhikr._id) : goNext()}
                  className="w-full rounded-2xl bg-[image:var(--sw-gradient)] px-5 py-4 text-base font-bold text-black transition hover:brightness-110 active:scale-[0.995]"
                >
                  {currentDhikrCount < currentDhikr.targetCount ? tr("Count +1") : currentIndex < filteredAthkar.length - 1 ? tr("Continue") : tr("Completed")}
                </button>

                <div className="mt-3 hidden grid-cols-3 gap-2 sm:grid">
                  <button onClick={() => void handleReset(currentDhikr._id)} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white">
                    <Icon name="refresh" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{tr("Reset")}</span>
                  </button>
                  <button onClick={() => startEdit(currentDhikr)} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white">
                    <Icon name="edit" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{tr("Edit")}</span>
                  </button>
                  <button onClick={() => void removeDhikr(currentDhikr)} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-rose-400/15 bg-black/20 px-2 py-2.5 text-xs text-rose-300/75 transition hover:bg-rose-400/[0.08] hover:text-rose-200">
                    <Icon name="trash" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{tr("Delete")}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-3xl border ${colors.border} ${colors.backgroundSecondary} p-8 text-center backdrop-blur-xl`}>
              <div className={`mx-auto grid h-12 w-12 place-items-center rounded-xl border ${colors.border} bg-white/[0.035]`}><Icon name="athkar" className={`h-5 w-5 ${colors.text}`} /></div>
              <h3 className="mt-4 text-lg font-bold text-white">{tr("No Athkar here yet")}</h3>
              <p className="mt-1 text-sm text-white/45">{selectedCategory === "custom" ? tr("Add your first custom Dhikr below.") : tr("This section currently has no entries.")}</p>
            </div>
          )}

          {selectedCategory === "custom" && (
            <section className={`rounded-3xl border ${colors.border} ${colors.backgroundSecondary} p-4 backdrop-blur-xl sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{tr("Custom Dhikr")}</h3>
                  <p className="mt-1 text-sm text-white/45">{tr("Add personal entries without changing the default sections.")}</p>
                </div>
                <button onClick={() => setShowAddForm((value) => !value)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">
                  <Icon name={showAddForm ? "chevronDown" : "plus"} className={`h-4 w-4 ${showAddForm ? "rotate-180" : ""}`} />
                  {showAddForm ? tr("Close") : tr("Add Dhikr")}
                </button>
              </div>

              {showAddForm && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Arabic text")}</span>
                    <textarea dir="rtl" rows={4} value={newDhikr.text} onChange={(e) => setNewDhikr((state) => ({ ...state, text: e.target.value }))} className={`w-full rounded-xl border ${colors.border} bg-black/30 p-3 text-right text-white outline-none focus:border-white/25`} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Translation")}</span>
                    <input value={newDhikr.translation} onChange={(e) => setNewDhikr((state) => ({ ...state, translation: e.target.value }))} className={`w-full rounded-xl border ${colors.border} bg-black/30 p-3 text-white outline-none focus:border-white/25`} />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Target count")}</span>
                    <input type="number" min="1" max="1000" value={newDhikr.targetCount} onChange={(e) => setNewDhikr((state) => ({ ...state, targetCount: parseInt(e.target.value) || 1 }))} className={`w-full rounded-xl border ${colors.border} bg-black/30 p-3 text-white outline-none focus:border-white/25`} />
                  </label>
                  <div className="flex items-end">
                    <button onClick={() => void handleAddDhikr()} className="w-full rounded-xl bg-[image:var(--sw-gradient)] px-4 py-3 font-semibold text-black transition hover:brightness-110">{tr("Save Dhikr")}</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {editingDhikr && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-lg" onClick={() => setEditingDhikr(null)} aria-label={tr("Close edit dialog")} />
          <div className={`relative z-10 w-full max-w-2xl rounded-3xl border ${colors.border} p-5 shadow-2xl sm:p-6`} style={{ background: "rgba(6,9,13,.97)" }}>
            <h3 className="text-xl font-bold text-white">{tr("Edit Athkar")}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Arabic text")}</span>
                <textarea dir="rtl" rows={4} value={editForm.text} onChange={(e) => setEditForm((state) => ({ ...state, text: e.target.value }))} className={`w-full rounded-xl border ${colors.border} bg-black/35 p-3 text-right text-white outline-none focus:border-white/25`} />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Translation")}</span>
                <input value={editForm.translation} onChange={(e) => setEditForm((state) => ({ ...state, translation: e.target.value }))} className={`w-full rounded-xl border ${colors.border} bg-black/35 p-3 text-white outline-none focus:border-white/25`} />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Target count")}</span>
                <input type="number" min="1" max="1000" value={editForm.targetCount} onChange={(e) => setEditForm((state) => ({ ...state, targetCount: parseInt(e.target.value) || 1 }))} className={`w-full rounded-xl border ${colors.border} bg-black/35 p-3 text-white outline-none focus:border-white/25`} />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-white/45">{tr("Category")}</span>
                <ChoiceSelect label={tr("Category")} value={editForm.category} onChange={value => setEditForm(state => ({...state, category: value}))} className="w-full" options={categories.map(category => ({value: category.id, label: category.name}))} />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setEditingDhikr(null)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.07] hover:text-white">{tr("Cancel")}</button>
              <button onClick={() => void saveEdit()} className="rounded-xl bg-[image:var(--sw-gradient)] px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110">{tr("Save changes")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
