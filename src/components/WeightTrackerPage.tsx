import { useMemo, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { PageHeader } from "./PageHeader";
import { toast } from "sonner";
import { Icon } from "./icons";

type WeightEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // in kg (you can change label only)
  note?: string;
};

function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const STORAGE_KEY = "weight_entries_v1";

function readEntries(): WeightEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id ?? crypto.randomUUID()),
        date: String(x.date ?? getLocalDateKey()),
        weight: Number(x.weight ?? 0),
        note: x.note ? String(x.note) : "",
      }))
      .filter((x) => x.weight > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  } catch {
    return [];
  }
}

function writeEntries(entries: WeightEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function fmtDelta(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

export function WeightTrackerPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const [entries, setEntries] = useState<WeightEntry[]>(() => readEntries());
  const [date, setDate] = useState(getLocalDateKey());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [unit, setUnit] = useState<"kg" | "lbs">(() => {
    try {
      const saved = localStorage.getItem("weight_unit");
      return saved === "lbs" ? "lbs" : "kg";
    } catch {
      return "kg";
    }
  });

  const stats = useMemo(() => {
    const sortedOldest = [...entries].sort((a, b) => (a.date > b.date ? 1 : -1));
    const latest = entries[0]?.weight ?? null;
    const start = sortedOldest[0]?.weight ?? null;

    const last7 = sortedOldest.filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      const now = new Date(getLocalDateKey() + "T00:00:00");
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    });

    const weekStart = last7[0]?.weight ?? null;

    return {
      latest,
      start,
      changeTotal: latest != null && start != null ? latest - start : null,
      weekStart,
      changeWeek: latest != null && weekStart != null ? latest - weekStart : null,
      series: sortedOldest,
    };
  }, [entries]);

  const addEntry = () => {
    const w = Number(weight);
    if (!w || w <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    const entry: WeightEntry = {
      id: crypto.randomUUID(),
      date,
      weight: w,
      note: note.trim(),
    };

    // Replace if same date exists (keep it simple)
    const next = [entry, ...entries.filter((e) => e.date !== date)];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));

    setEntries(next);
    writeEntries(next);

    setWeight("");
    setNote("");
    toast.success("Weight saved.");
  };

  const toggleUnit = () => {
    const newUnit = unit === "kg" ? "lbs" : "kg";
    setUnit(newUnit);
    localStorage.setItem("weight_unit", newUnit);
  };

  const deleteEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    writeEntries(next);
  };

  // Simple SVG chart (no libs)
  const chart = useMemo(() => {
    const s = stats.series;
    if (s.length < 2) return null;

    const w = 520;
    const h = 140;
    const pad = 10;

    const ys = s.map((e) => e.weight);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const range = Math.max(1, maxY - minY);

    const pts = s.map((e, i) => {
      const x = pad + (i * (w - pad * 2)) / (s.length - 1);
      const y = pad + (1 - (e.weight - minY) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return { w, h, pts: pts.join(" "), minY, maxY };
  }, [stats.series]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Weight Tracker" subtitle="Track your progress over time" />

      {/* Unit Toggle */}
      <div className="flex justify-center animate-slide-up">
        <button
          onClick={toggleUnit}
          className={`sw-theme-hover-border flex items-center gap-2 px-4 py-2 rounded-xl border ${colors.border} ${colors.backgroundSecondary} transition-all duration-300 hover:scale-[1.02]`}
        >
          <span className={`${colors.textSecondary} text-sm`}>Unit:</span>
          <span className={`${colors.text} font-semibold`}>{unit}</span>
          <Icon name="refresh" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={`rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md border ${colors.border} ${colors.backgroundSecondary} animate-slide-up`} style={{ ['--delay' as any]: '200ms' }}>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4 transition-all duration-300 hover:scale-105`}>
              <div className={`${colors.textSecondary} text-xs mb-1 flex items-center gap-1`}>
                <Icon name="weight" className="h-3.5 w-3.5" />
                <span>Current Weight</span>
              </div>
              <div className={`${colors.text} text-2xl font-bold`}>
                {stats.latest != null ? `${stats.latest.toFixed(1)} ${unit}` : "—"}
              </div>
            </div>

            <div className={`rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4 transition-all duration-300 hover:scale-105`}>
              <div className={`${colors.textSecondary} text-xs mb-1 flex items-center gap-1`}>
                <Icon name="chart" className="h-3.5 w-3.5" />
                <span>Total Change</span>
              </div>
              <div className={`text-2xl font-bold ${stats.changeTotal && stats.changeTotal < 0 ? 'text-green-400' : stats.changeTotal && stats.changeTotal > 0 ? 'text-orange-400' : colors.text}`}>
                {stats.changeTotal != null ? `${fmtDelta(stats.changeTotal)} ${unit}` : "—"}
              </div>
            </div>

            <div className={`rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4 transition-all duration-300 hover:scale-105`}>
              <div className={`${colors.textSecondary} text-xs mb-1 flex items-center gap-1`}>
                <Icon name="bolt" className="h-3.5 w-3.5" />
                <span>7-Day Change</span>
              </div>
              <div className={`text-2xl font-bold ${stats.changeWeek && stats.changeWeek < 0 ? 'text-green-400' : stats.changeWeek && stats.changeWeek > 0 ? 'text-orange-400' : colors.text}`}>
                {stats.changeWeek != null ? `${fmtDelta(stats.changeWeek)} ${unit}` : "—"}
              </div>
            </div>
          </div>

          {chart ? (
            <div className={`rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`${colors.textSecondary} text-sm flex items-center gap-1`}>
                  <Icon name="chart" className="h-3.5 w-3.5" />
                  <span>Progress Chart</span>
                </div>
                <div className={`${colors.textSecondary} text-xs`}>
                  {chart.minY.toFixed(1)} – {chart.maxY.toFixed(1)} {unit}
                </div>
              </div>
              <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="w-full h-[140px]">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <polyline 
                  points={chart.pts} 
                  fill="none" 
                  stroke="url(#chartGradient)" 
                  strokeWidth="3" 
                  className={`${colors.text}`}
                />
              </svg>
            </div>
          ) : (
            <div className={`${colors.textSecondary} text-sm`}>Add at least 2 entries to see the chart.</div>
          )}

          <div className={`rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full ${colors.backgroundTertiary} border ${colors.borderHover} rounded-lg px-3 py-2 ${colors.textSecondary} text-sm focus:outline-none`}
              />
              <input
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={`Weight (${unit})`}
                className={`w-full ${colors.backgroundTertiary} border ${colors.borderHover} rounded-lg px-3 py-2 ${colors.textSecondary} text-sm focus:outline-none`}
              />
              <button
                onClick={addEntry}
                className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-[image:var(--sw-gradient)] text-black rounded-lg text-sm transition-all duration-300 font-semibold hover:brightness-110 hover:scale-[1.02] active:scale-95"
              >
                <Icon name="save" className="h-4 w-4" />
                Save Entry
              </button>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g., calories, workout, how you felt)"
              className={`mt-2 w-full min-h-[44px] ${colors.backgroundTertiary} border ${colors.borderHover} rounded-lg px-3 py-2 ${colors.textSecondary} text-sm focus:outline-none`}
            />
          </div>

          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className={`${colors.textSecondary} text-sm`}>No entries yet.</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className={`flex items-start justify-between gap-3 rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-4`}>
                  <div className="min-w-0">
                    <div className={`${colors.text} font-semibold flex items-center gap-2`}>
                      <Icon name="weight" className="h-4 w-4" />
                      <span>{e.weight.toFixed(1)} {unit}</span>
                      <span className={`${colors.textSecondary} text-xs`}>• {new Date(e.date).toLocaleDateString()}</span>
                    </div>
                    {e.note ? <div className={`${colors.textSecondary} text-sm mt-1 ml-7`}>{e.note}</div> : null}
                  </div>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="shrink-0 p-2 text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-400/10"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className={`${colors.textSecondary} text-xs text-center`}>
            <span className="inline-flex items-center justify-center gap-1.5"><Icon name="info" className="h-3.5 w-3.5" /> Track consistently for better insights. You can switch between kg and lbs anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
