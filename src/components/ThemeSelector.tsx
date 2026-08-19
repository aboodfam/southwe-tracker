import { useEffect, useRef, useState } from "react";
import { useTheme, Theme } from "../contexts/ThemeContext";
import { useSound, SOUND_PACKS, SfxName, SoundPack } from "../contexts/SoundContext";
import { Icon, IconName } from "./icons";

type ThemeOption = {
  id: Theme;
  name: string;
  description: string;
  accent: string;
  accent2: string;
  surface: string;
};

const themes: ThemeOption[] = [
  { id: "cyan", name: "Aurora", description: "Electric aqua", accent: "#22d3ee", accent2: "#3b82f6", surface: "#07111b" },
  { id: "white", name: "Frost", description: "Clean silver", accent: "#f8fafc", accent2: "#bae6fd", surface: "#111827" },
  { id: "black", name: "Obsidian", description: "Minimal graphite", accent: "#94a3b8", accent2: "#f8fafc", surface: "#090b0f" },
  { id: "red", name: "Crimson", description: "Deep ruby", accent: "#f43f5e", accent2: "#fb923c", surface: "#17060a" },
  { id: "purple", name: "Amethyst", description: "Dark violet", accent: "#a855f7", accent2: "#d946ef", surface: "#11091d" },
  { id: "green", name: "Emerald", description: "Focused green", accent: "#10b981", accent2: "#a3e635", surface: "#07150f" },
];

const soundEffectNames: { id: SfxName; name: string; description: string }[] = [
  { id: "notification", name: "Created", description: "Adding things" },
  { id: "success", name: "Completed", description: "Finishing items" },
  { id: "complete", name: "Big Win", description: "Workout/day complete" },
];

const packIcons: Record<SoundPack, IconName> = {
  neon: "soundWave",
  arcade: "gamepad",
  cinematic: "film",
  lofi: "moon",
  crystal: "diamond",
  custom: "headphones",
};

function randomNeonHex() {
  const hue = (Math.random() * 360 + 137.508) % 360;
  const s = 0.92;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (hue < 60) { rr = c; gg = x; }
  else if (hue < 120) { rr = x; gg = c; }
  else if (hue < 180) { gg = c; bb = x; }
  else if (hue < 240) { gg = x; bb = c; }
  else if (hue < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function ThemePreview({ option, selected }: { option: ThemeOption; selected: boolean }) {
  return (
    <div
      className="relative h-20 overflow-hidden rounded-xl border border-white/10 p-2.5"
      style={{ background: `linear-gradient(145deg, ${option.surface}, #020304)` }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-8 rounded-full bg-white/10" />
      </div>
      <div className="grid grid-cols-[22px_1fr] gap-2">
        <div className="rounded-md border border-white/10 bg-white/[0.04]" />
        <div className="space-y-1.5">
          <div className="h-2.5 w-3/4 rounded-full" style={{ background: `linear-gradient(90deg, ${option.accent}, ${option.accent2})` }} />
          <div className="h-1.5 w-full rounded-full bg-white/10" />
          <div className="h-1.5 w-4/5 rounded-full bg-white/[0.07]" />
        </div>
      </div>
      {selected && (
        <div className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white text-black shadow-lg">
          <Icon name="check" className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

export function ThemeSelector() {
  const { theme, setTheme, getThemeColors, useCustomAccent, setUseCustomAccent, customAccent, setCustomAccent } = useTheme();
  const {
    enabled: soundEnabled,
    setEnabled: setSoundEnabled,
    volume,
    setVolume,
    soundPack,
    setSoundPack,
    customSounds,
    uploadCustomSound,
    removeCustomSound,
    play,
    previewSound,
  } = useSound();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"themes" | "sounds">("themes");
  const [uploadingSfx, setUploadingSfx] = useState<SfxName | null>(null);
  const [accentDraft, setAccentDraft] = useState(customAccent);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSfxRef = useRef<SfxName | null>(null);
  const colors = getThemeColors();
  const currentTheme = themes.find((item) => item.id === theme) ?? themes[0];

  useEffect(() => {
    setAccentDraft(customAccent);
  }, [customAccent]);

  const commitAccentDraft = () => {
    const normalized = accentDraft.startsWith("#") ? accentDraft : `#${accentDraft}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setCustomAccent(normalized);
      setAccentDraft(normalized);
    } else {
      setAccentDraft(customAccent);
    }
  };

  const handleFileUpload = async (sfxName: SfxName, file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please select an audio file");
      return;
    }
    setUploadingSfx(sfxName);
    try {
      await uploadCustomSound(sfxName, file);
    } catch (error) {
      alert("Failed to upload sound: " + (error as Error).message);
    } finally {
      setUploadingSfx(null);
      pendingSfxRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileUpload = (sfxName: SfxName) => {
    pendingSfxRef.current = sfxName;
    fileInputRef.current?.click();
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className={`sw-theme-hover-border group flex items-center gap-2 rounded-xl border px-2.5 py-2 sm:px-3 ${colors.border} ${colors.backgroundSecondary} backdrop-blur-xl transition duration-200`}
        title="Appearance and sound settings"
        aria-expanded={isOpen}
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon name="settings" className="h-4 w-4 text-white/80 transition-transform duration-300 group-hover:rotate-45" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-black/60" style={{ background: currentTheme.accent }} />
        </span>
        <span className={`hidden text-sm font-medium sm:inline ${colors.text}`}>Customize</span>
        <Icon name="chevronDown" className={`hidden h-4 w-4 sm:block ${colors.textSecondary} transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <button className="fixed inset-0 z-[90] cursor-default" onClick={() => setIsOpen(false)} aria-label="Close settings" />
          <div className={`absolute right-0 top-full z-[100] mt-2 w-[min(92vw,430px)] overflow-hidden rounded-3xl border ${colors.border} ${colors.backgroundSecondary} shadow-2xl backdrop-blur-2xl`}>
            <div className="border-b border-white/10 px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className={`text-base font-semibold ${colors.text}`}>Personalize SouthWe</p>
                  <p className={`mt-0.5 text-xs ${colors.textSecondary}`}>Appearance and reward feedback</p>
                </div>
                <div className="h-8 w-16 rounded-full border border-white/10 p-1" style={{ background: `linear-gradient(90deg, ${currentTheme.surface}, ${currentTheme.accent}35)` }}>
                  <div className="h-full w-full rounded-full bg-[image:var(--sw-gradient)] opacity-80" />
                </div>
              </div>

              <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
                {([
                  ["themes", "palette", "Appearance"],
                  ["sounds", "volume", "Sounds"],
                ] as const).map(([id, icon, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${activeTab === id ? "bg-white/10 text-white shadow-sm" : `${colors.textSecondary} hover:bg-white/5 hover:text-white`}`}
                  >
                    <Icon name={icon} className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="h-4" />
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-4 sm:p-5">
              {activeTab === "themes" ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <h3 className={`text-sm font-semibold ${colors.text}`}>Theme preset</h3>
                        <p className={`mt-1 text-xs ${colors.textSecondary}`}>Each preset now changes the atmosphere, surfaces, borders and accent.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {themes.map((option) => {
                        const selected = theme === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`rounded-2xl border p-2 text-left transition duration-200 ${selected ? "border-white/30 bg-white/[0.07] shadow-lg" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}
                          >
                            <ThemePreview option={option} selected={selected} />
                            <div className="px-1 pb-1 pt-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-semibold ${selected ? colors.text : "text-white/85"}`}>{option.name}</span>
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: option.accent, boxShadow: `0 0 14px ${option.accent}80` }} />
                              </div>
                              <span className={`mt-0.5 block text-[11px] ${colors.textSecondary}`}>{option.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className={`text-sm font-semibold ${colors.text}`}>Custom accent</h4>
                        <p className={`mt-1 text-xs leading-5 ${colors.textSecondary}`}>Keep the preset surfaces, but replace its accent and glow with your own color.</p>
                      </div>
                      <button
                        onClick={() => setUseCustomAccent(!useCustomAccent)}
                        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${useCustomAccent ? "border-white/25" : "border-white/10 bg-white/10"}`}
                        style={useCustomAccent ? { background: "var(--sw-gradient)" } : undefined}
                        aria-pressed={useCustomAccent}
                      >
                        <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${useCustomAccent ? "translate-x-[21px]" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    <div className={`mt-4 grid gap-3 transition-opacity ${useCustomAccent ? "opacity-100" : "opacity-45"}`}>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                        <input type="color" value={customAccent} onChange={(e) => { setCustomAccent(e.target.value); setAccentDraft(e.target.value); }} disabled={!useCustomAccent} className="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Pick custom accent" />
                        <input
                          type="text"
                          value={accentDraft}
                          onChange={(e) => setAccentDraft(e.target.value)}
                          onBlur={commitAccentDraft}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                          disabled={!useCustomAccent}
                          className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-white outline-none"
                          spellCheck={false}
                          maxLength={7}
                        />
                        <div className="h-7 w-16 rounded-lg border border-white/10 bg-[image:var(--sw-gradient)]" />
                      </div>
                      <button
                        onClick={() => { const next = randomNeonHex(); setCustomAccent(next); setAccentDraft(next); setUseCustomAccent(true); play("notification"); }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                      >
                        <Icon name="shuffle" className="h-4 w-4" />
                        Generate accent
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <h3 className={`text-sm font-semibold ${colors.text}`}>Reward sounds</h3>
                      <p className={`mt-1 text-xs ${colors.textSecondary}`}>Only plays for meaningful actions.</p>
                    </div>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`relative h-6 w-11 rounded-full border transition ${soundEnabled ? "border-white/25" : "border-white/10 bg-white/10"}`}
                      style={soundEnabled ? { background: "var(--sw-gradient)" } : undefined}
                      aria-pressed={soundEnabled}
                    >
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${soundEnabled ? "translate-x-[21px]" : "translate-x-0.5"}`} />
                    </button>
                  </div>

                  {soundEnabled && (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className={`text-sm font-medium ${colors.text}`}>Volume</span>
                          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-white/70">{Math.round(volume * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="sw-range w-full" />
                      </div>

                      <div>
                        <h4 className={`mb-3 text-sm font-semibold ${colors.text}`}>Sound character</h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(SOUND_PACKS).map(([packId, pack]) => {
                            const selected = soundPack === packId;
                            return (
                              <button
                                key={packId}
                                onClick={() => { setSoundPack(packId as SoundPack); previewSound(packId as SoundPack, "success"); }}
                                className={`rounded-2xl border p-3 text-left transition ${selected ? "border-white/25 bg-white/[0.07]" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <span className={`grid h-8 w-8 place-items-center rounded-lg border ${selected ? colors.border : "border-white/10"} bg-white/[0.04]`}>
                                    <Icon name={packIcons[packId as SoundPack]} className={`h-4 w-4 ${selected ? colors.text : "text-white/60"}`} />
                                  </span>
                                  <span className={`text-sm font-semibold ${selected ? colors.text : "text-white/80"}`}>{pack.name}</span>
                                </div>
                                <p className={`text-[11px] leading-4 ${colors.textSecondary}`}>{pack.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {soundPack === "custom" && (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <h4 className={`mb-3 text-sm font-semibold ${colors.text}`}>Custom files</h4>
                          <div className="space-y-2">
                            {soundEffectNames.map((sfx) => (
                              <div key={sfx.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white/85">{sfx.name}</div>
                                  <div className={`text-xs ${colors.textSecondary}`}>{sfx.description}</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {customSounds[sfx.id] ? (
                                    <>
                                      <button onClick={() => previewSound("custom", sfx.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10 hover:text-white" title="Preview"><Icon name="play" className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => removeCustomSound(sfx.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/15 text-rose-300 hover:bg-rose-400/10" title="Remove"><Icon name="trash" className="h-3.5 w-3.5" /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => triggerFileUpload(sfx.id)} disabled={uploadingSfx === sfx.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50">
                                      <Icon name="upload" className="h-3.5 w-3.5" />
                                      {uploadingSfx === sfx.id ? "Uploading" : "Upload"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; const sfx = pendingSfxRef.current; if (file && sfx) void handleFileUpload(sfx, file); }} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
