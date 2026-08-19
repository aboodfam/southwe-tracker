import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../contexts/ThemeContext";
import { PageHeader } from "./PageHeader";

type Sex = "male" | "female";
type Goal = "maintain" | "cut" | "bulk";
type Pace = "mild" | "moderate" | "aggressive";

const ACTIVITY = [
  { id: "sedentary", label: "Sedentary", sub: "Little/no exercise", mult: 1.2 },
  { id: "light", label: "Light", sub: "1–3 days/week", mult: 1.375 },
  { id: "moderate", label: "Moderate", sub: "3–5 days/week", mult: 1.55 },
  { id: "active", label: "Active", sub: "6–7 days/week", mult: 1.725 },
  { id: "athlete", label: "Athlete", sub: "Hard training / 2x/day", mult: 1.9 },
] as const;

function round(n: number) {
  return Math.round(n);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function mifflinStJeor({
  sex,
  weightKg,
  heightCm,
  age,
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}) {
  // BMR = 10W + 6.25H - 5A + s
  // s = +5 male, -161 female
  const s = sex === "male" ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

const GOAL_LABEL: Record<Goal, string> = {
  maintain: "Maintain",
  cut: "Cut",
  bulk: "Bulk",
};

const PACE_LABEL: Record<Pace, string> = {
  mild: "Mild",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

// % adjustment applied to TDEE to get a calorie target.
// Keep it simple but realistic; users can pick pace.
const GOAL_ADJUSTMENT: Record<Goal, Record<Pace, number>> = {
  maintain: { mild: 0, moderate: 0, aggressive: 0 },
  cut: { mild: -0.10, moderate: -0.15, aggressive: -0.20 },
  bulk: { mild: 0.05, moderate: 0.10, aggressive: 0.15 },
};

// Macro heuristics (grams per kg) by goal.
// Protein increases in a cut to preserve muscle; bulk can be slightly lower.
const PROTEIN_G_PER_KG: Record<Goal, number> = {
  maintain: 1.8,
  cut: 2.2,
  bulk: 1.6,
};

const FAT_G_PER_KG: Record<Goal, number> = {
  maintain: 0.8,
  cut: 0.8,
  bulk: 0.9,
};

const FAT_MIN_G_PER_KG = 0.6;


const STORAGE_KEY = "sw_macros_form_v1";

function isOneOf<T extends string>(v: any, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

function MacroCard({
  label,
  grams,
  kcal,
  pct,
  hint,
}: {
  label: string;
  grams: number;
  kcal: number;
  pct: number;
  hint: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 animate-float-in"
      style={{ boxShadow: "0 14px 36px rgba(0,0,0,.22)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--sw-gradient)] opacity-45" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs text-white/[0.42]">{hint}</div>
        </div>

        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-[rgb(var(--sw-accent-rgb))]">
          {round(pct)}%
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-extrabold leading-none text-white">{round(grams)}g</div>
          <div className="mt-1 text-sm text-white/[0.42]">{round(kcal)} kcal</div>
        </div>

        <div className="w-28 sm:w-36">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-[image:var(--sw-gradient)] transition-[width] duration-700"
              style={{ width: `${clamp(pct, 0, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


export function MacrosPage() {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const savedProfile = useQuery(api.userData.getMacroProfile);
  const saveMacroProfile = useMutation(api.userData.saveMacroProfile);
  const [hydrated, setHydrated] = useState(false);

  const [sex, setSex] = useState<Sex>("male");
  // Keep inputs as strings so the user can clear the field (no forced 0 while typing)
  const [age, setAge] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [activityId, setActivityId] = useState<(typeof ACTIVITY)[number]["id"]>("moderate");

  const [goal, setGoal] = useState<Goal>("maintain");
  const [pace, setPace] = useState<Pace>("moderate");

  // Hydrate from the account first so calculator inputs follow the user across
  // refreshes/devices. localStorage remains a fallback for old installs/offline use.
  useEffect(() => {
    if (savedProfile === undefined || hydrated) return;

    let data: any = savedProfile;
    if (!data && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
    }

    if (data) {
      if (isOneOf<Sex>(data.sex, ["male", "female"])) setSex(data.sex);
      if (typeof data.age === "string") setAge(data.age);
      if (typeof data.heightCm === "string") setHeightCm(data.heightCm);
      if (typeof data.weightKg === "string") setWeightKg(data.weightKg);

      const activityIds = ACTIVITY.map((a) => a.id) as (typeof ACTIVITY)[number]["id"][];
      if (isOneOf(data.activityId as any, activityIds)) setActivityId(data.activityId as any);
      if (isOneOf<Goal>(data.goal, ["maintain", "cut", "bulk"])) setGoal(data.goal);
      if (isOneOf<Pace>(data.pace, ["mild", "moderate", "aggressive"])) setPace(data.pace);
    }

    setHydrated(true);
  }, [savedProfile, hydrated]);

  // Persist locally immediately and sync to Convex with a small debounce.
  useEffect(() => {
    if (!hydrated) return;

    const payload = {
      sex,
      age,
      heightCm,
      weightKg,
      activityId,
      goal,
      pace,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    const timer = window.setTimeout(() => {
      void saveMacroProfile(payload).catch(() => {
        // Keep the local copy; Convex will be retried on the next edit.
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [hydrated, sex, age, heightCm, weightKg, activityId, goal, pace, saveMacroProfile]);

  const activity = ACTIVITY.find((a) => a.id === activityId) ?? ACTIVITY[2];

  const results = useMemo(() => {
    const wRaw = weightKg.trim() === "" ? NaN : Number(weightKg);
    const hRaw = heightCm.trim() === "" ? NaN : Number(heightCm);
    const aRaw = age.trim() === "" ? NaN : Number(age);

    if (!Number.isFinite(wRaw) || !Number.isFinite(hRaw) || !Number.isFinite(aRaw)) return null;

    const w = clamp(wRaw, 30, 250);
    const h = clamp(hRaw, 120, 230);
    const a = clamp(aRaw, 10, 90);

    const bmr = mifflinStJeor({ sex, weightKg: w, heightCm: h, age: a });
    const tdee = bmr * activity.mult;

    const adj = GOAL_ADJUSTMENT[goal][pace];
    const calories = tdee * (1 + adj);

    // Macro targets
    const proteinTarget = w * PROTEIN_G_PER_KG[goal];
    const fatTarget = w * FAT_G_PER_KG[goal];
    const fatMin = w * FAT_MIN_G_PER_KG;

    // Ensure we don't overshoot calories in extreme cases.
    // Priority: keep protein high, keep fat above a minimum, carbs fill the rest.
    let proteinG = proteinTarget;
    let fatG = fatTarget;

    // If protein+fat exceed calories, reduce fat down to minimum first.
    const proteinCals0 = proteinG * 4;
    const fatCals0 = fatG * 9;
    const over0 = proteinCals0 + fatCals0 - calories;
    if (over0 > 0) {
      // reduce fat calories if possible
      const fatCalsMin = fatMin * 9;
      const roomAfterMinFat = calories - proteinCals0 - fatCalsMin;
      if (roomAfterMinFat >= 0) {
        fatG = fatMin;
      } else {
        // Even minimum fat doesn't fit; reduce protein to fit.
        fatG = fatMin;
        const proteinMaxCals = Math.max(0, calories - fatG * 9);
        proteinG = proteinMaxCals / 4;
      }
    }

    const proteinCals = proteinG * 4;
    const fatCals = fatG * 9;
    const remaining = Math.max(0, calories - proteinCals - fatCals);
    const carbsG = remaining / 4;

    const denom = Math.max(1, calories);
    const pct = {
      protein: (proteinCals / denom) * 100,
      fat: (fatCals / denom) * 100,
      carbs: (remaining / denom) * 100,
    };

    return {
      bmr,
      tdee,
      calories,
      goal,
      pace,
      adjustment: adj,
      macros: {
        proteinG,
        fatG,
        carbsG,
        proteinCals,
        fatCals,
        carbsCals: remaining,
        pct,
      },
    };
  }, [sex, weightKg, heightCm, age, activity.mult, goal, pace]);



  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <PageHeader title="Macros Calculator" subtitle="Enter your stats and get calories + protein, carbs, fat" />

      {/* Main Panel */}
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-5 animate-slide-up">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(900px 320px at 20% 10%, ${colors.primary.replace('rgb(', 'rgba(').replace(')', ',0.09)')}, transparent 60%),
                           radial-gradient(700px 260px at 80% 20%, ${colors.primary.replace('rgb(', 'rgba(').replace(')', ',0.05)')}, transparent 60%)`,
            }}
          />

          <div className="relative z-10 space-y-5">
            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5`}>
                <div className={`${colors.text} font-semibold`}>Your Stats</div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Sex</div>
                    <select
                      value={sex}
                      onChange={(e) => setSex(e.target.value as Sex)}
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Age</div>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      min={10}
                      max={90}
                      placeholder="e.g. 18"
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                    />
                  </label>

                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Height (cm)</div>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      min={120}
                      max={230}
                      placeholder="e.g. 175"
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                    />
                  </label>

                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Weight (kg)</div>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      min={30}
                      max={250}
                      placeholder="e.g. 75"
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                    />
                  </label>

                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Goal</div>
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value as Goal)}
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                    >
                      <option value="maintain">Maintain</option>
                      <option value="cut">Cut (fat loss)</option>
                      <option value="bulk">Bulk (muscle gain)</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <div className={`${colors.textSecondary} text-xs`}>Pace</div>
                    <select
                      value={pace}
                      onChange={(e) => setPace(e.target.value as Pace)}
                      disabled={goal === "maintain"}
                      className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10 ${goal === "maintain" ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block space-y-1">
                  <div className={`${colors.textSecondary} text-xs`}>Activity Level</div>
                  <select
                    value={activityId}
                    onChange={(e) => setActivityId(e.target.value as any)}
                    className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${colors.text} focus:outline-none focus:ring-2 focus:ring-white/10`}
                  >
                    {ACTIVITY.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} — {a.sub}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={`rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5`}>
                <div className={`${colors.text} font-semibold`}>What do BMR & TDEE mean?</div>
                <div className={`${colors.textSecondary} text-sm mt-2 leading-relaxed`}>
                  <div>
                    <span className={`${colors.text} font-semibold`}>BMR</span> is the calories your body burns at rest
                    (just to stay alive).
                  </div>
                  <div className="mt-2">
                    <span className={`${colors.text} font-semibold`}>TDEE</span> is your maintenance calories
                    (BMR × activity level). If you eat around this number, your weight usually stays stable.
                  </div>
                  <div className="mt-3 text-xs">
                    <div>
                      <span className={`${colors.text} font-semibold`}>Cut</span> = calorie deficit, <span className={`${colors.text} font-semibold`}>Bulk</span> = calorie surplus.
                      Choose a pace to make the deficit/surplus smaller or bigger.
                    </div>
                    <div className="mt-2">
                      Macros are calculated automatically: higher protein during a cut, fats kept above a minimum, carbs fill the rest.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!results && (
              <div className={`text-center ${colors.textSecondary} text-sm`}>
                Enter your age, height, and weight to see your calories and macros.
              </div>
            )}

            {/* Summary */}
            {results && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 animate-float-in`}>
                  <div className={`${colors.textSecondary} text-xs`}>BMR</div>
                  <div className={`${colors.text} text-2xl font-extrabold mt-1`}>{round(results.bmr)} kcal</div>
                  <div className={`${colors.textSecondary} text-xs mt-2`}>Calories burned at rest</div>
                </div>

                <div className={`rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 animate-float-in`}>
                  <div className={`${colors.textSecondary} text-xs`}>TDEE</div>
                  <div className={`${colors.text} text-2xl font-extrabold mt-1`}>{round(results.tdee)} kcal</div>
                  <div className={`${colors.textSecondary} text-xs mt-2`}>Maintenance calories</div>
                </div>

                <div
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5 animate-float-in"
                  style={{ boxShadow: `0 0 30px ${colors.primary.replace('rgb(', 'rgba(').replace(')', ',0.07)')}` }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--sw-gradient)] opacity-55" />
                  <div className={`${colors.textSecondary} text-xs`}>
                    {results.goal === "maintain" ? "Daily Calories" : `${GOAL_LABEL[results.goal]} Calories`}
                  </div>
                  <div className={`${colors.text} text-3xl font-extrabold mt-1`}>{round(results.calories)} kcal</div>
                  <div className={`${colors.textSecondary} text-xs mt-2`}>
                    {results.goal === "maintain"
                      ? "Estimated maintenance"
                      : `${PACE_LABEL[results.pace]} ${Math.abs(round(results.adjustment * 100))}% ${
                          results.goal === "cut" ? "deficit" : "surplus"
                        } from TDEE`}
                  </div>
                </div>
              </div>
            )}

            {/* Macros */}
            {results && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MacroCard
                  label="Protein"
                  grams={results.macros.proteinG}
                  kcal={results.macros.proteinCals}
                  pct={results.macros.pct.protein}
                  hint="Muscle + recovery"
                />
                <MacroCard
                  label="Fat"
                  grams={results.macros.fatG}
                  kcal={results.macros.fatCals}
                  pct={results.macros.pct.fat}
                  hint="Hormones + joints"
                />
                <MacroCard
                  label="Carbs"
                  grams={results.macros.carbsG}
                  kcal={results.macros.carbsCals}
                  pct={results.macros.pct.carbs}
                  hint="Training fuel"
                />
              </div>
            )}

            <div className={`text-center ${colors.textSecondary} text-xs pt-1`}>
              Estimates only (not medical advice). Adjust based on weekly scale trend + performance.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
