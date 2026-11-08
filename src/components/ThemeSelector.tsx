import { AndroidDeviceList } from "./AndroidDeviceList";
import { androidRequest, disconnectAndroid, hasAndroidBridge } from "../lib/androidBridge";
import { ColorWheelSheet } from "./ColorWheelSheet";
import { LanguageSelector } from "./LanguageSelector";
import { t as tr, useLocale } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useTheme, Theme } from "../contexts/ThemeContext";
import { useSound, SOUND_PACKS, SfxName, SoundPack } from "../contexts/SoundContext";
import { Icon, IconName } from "./icons";
import { api } from "../../convex/_generated/api";


const SUPPORT_EMAIL = "ceventic1@gmail.com";

function clearLocalAccountData() {
  const remove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (
      key === "theme" ||
      key.startsWith("sw_") ||
      key.startsWith("ceventic_") ||
      key.startsWith("athkar_completed_dates_")
    ) {
      remove.push(key);
    }
  }
  for (const key of remove) localStorage.removeItem(key);

  const sessionRemove: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key && key.startsWith("ceventic_")) sessionRemove.push(key);
  }
  for (const key of sessionRemove) sessionStorage.removeItem(key);
}

function AccountSettingsPanel() {
  useLocale();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { signOut } = useAuthActions();
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const desktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const href = (path: string) => (desktopApp ? `#${path}` : path);

  const deleteAccount = async () => {
    if (deleting || confirmation.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteMyAccount({ confirmation });
      await disconnectAndroid();
      clearLocalAccountData();
      try {
        await signOut();
      } catch {
        // The deletion mutation already removed every auth session. signOut is
        // only used here to clear the auth client's local token state.
      }
      toast.success(tr("Ceventic account deleted"));
      window.setTimeout(() => window.location.assign(desktopApp ? "#/" : "/"), 250);
    } catch (error: any) {
      toast.error(error?.message ?? tr("Could not delete your account"));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <AndroidDeviceList />
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${colors.border} bg-white/[0.04]`}>
            <Icon name="shield" className={`h-4 w-4 ${colors.text}`} />
          </span>
          <div>
            <h3 className={`text-sm font-semibold ${colors.text}`}>{tr("Account & privacy")}</h3>
            <p className={`mt-1 text-xs leading-5 ${colors.textSecondary}`}>{tr("Ceventic beta support:")} {SUPPORT_EMAIL}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a href={href("/privacy")} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2 text-center text-xs text-white/65 transition hover:bg-white/[0.07] hover:text-white">{tr("Privacy")}</a>
          <a href={href("/terms")} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2 text-center text-xs text-white/65 transition hover:bg-white/[0.07] hover:text-white">{tr("Terms")}</a>
          <a href={href("/delete-account")} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2 text-center text-xs text-white/65 transition hover:bg-white/[0.07] hover:text-white">{tr("Deletion")}</a>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.035] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-400/20 bg-rose-400/[0.06] text-rose-300">
            <Icon name="trash" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{tr("Delete account & data")}</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">{tr("Permanently removes your account, sign-in links, routines, habits, workouts, progress, Athkar data, macros and other Ceventic data. This cannot be undone.")}</p>
          </div>
        </div>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-4 w-full rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/[0.12]"
          >
            {tr("Delete account & data")} </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-rose-400/15 bg-black/25 p-3">
            <p className="text-xs leading-5 text-white/55">{tr("Type")} <strong className="text-white">DELETE</strong> {tr("to confirm permanent deletion.")}</p>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.slice(0, 16))}
              placeholder="DELETE"
              autoComplete="off"
              className="w-full rounded-xl border border-white/12 bg-black/50 px-3 py-2.5 text-sm font-semibold tracking-[0.08em] text-white outline-none transition focus:border-rose-300/45"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setConfirmingDelete(false); setConfirmation(""); }}
                disabled={deleting}
                className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                {tr("Cancel")} </button>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleting || confirmation.trim().toUpperCase() !== "DELETE"}
                className="rounded-xl border border-rose-400/25 bg-rose-500/15 px-3 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {deleting ? tr("Deleting…") : tr("Delete forever")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ThemeOption = {
  id: Theme;
  name: string;
  description: string;
  accent: string;
  accent2: string;
  surface: string;
};

const themes: ThemeOption[] = [
  { id: "cyan", get name() { return tr("Aurora"); }, get description() { return tr("Electric aqua"); }, accent: "#22d3ee", accent2: "#3b82f6", surface: "#07111b" },
  { id: "white", get name() { return tr("Frost"); }, get description() { return tr("Clean silver"); }, accent: "#f5f5f5", accent2: "#a3a3a3", surface: "#111827" },
  { id: "black", get name() { return tr("Obsidian"); }, get description() { return tr("Minimal graphite"); }, accent: "#a3a3a3", accent2: "#e5e5e5", surface: "#090b0f" },
  { id: "red", get name() { return tr("Crimson"); }, get description() { return tr("Deep ruby"); }, accent: "#f43f5e", accent2: "#fb923c", surface: "#17060a" },
  { id: "purple", get name() { return tr("Amethyst"); }, get description() { return tr("Dark violet"); }, accent: "#a855f7", accent2: "#d946ef", surface: "#11091d" },
  { id: "green", get name() { return tr("Emerald"); }, get description() { return tr("Focused green"); }, accent: "#10b981", accent2: "#a3e635", surface: "#07150f" },
];

const soundEffectNames: { id: SfxName; name: string; description: string }[] = [
  { id: "notification", get name() { return tr("Created"); }, get description() { return tr("Adding things"); } },
  { id: "success", get name() { return tr("Completed"); }, get description() { return tr("Finishing items"); } },
  { id: "complete", get name() { return tr("Big Win"); }, get description() { return tr("Workout/day complete"); } },
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

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  useLocale();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={tr(label)}
      onClick={onChange}
      dir="ltr"
      className={`sw-toggle relative inline-flex h-[26px] w-[46px] shrink-0 overflow-hidden rounded-full border transition-colors duration-200 ${checked ? "border-white/25" : "border-white/12 bg-white/[0.12]"}`}
      style={{
        padding: "2px",
        minHeight: "26px",
        minWidth: "46px",
        background: checked ? "var(--sw-gradient)" : undefined,
      }}
    >
      <span
        className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.45)] transition-[left] duration-200 ease-out"
        style={{ left: checked ? "22px" : "2px" }}
      />
    </button>
  );
}

function ThemePreview({ option, selected }: { option: ThemeOption; selected: boolean }) {
  return (
    <div aria-hidden="true" className="relative flex h-12 flex-col gap-1.5 overflow-hidden rounded-lg border border-white/10 p-2" style={{ background: `linear-gradient(145deg, ${option.surface}, #020304)` }}>
      <div className="h-1 w-10 rounded-full bg-white/15" />
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="w-3 rounded-sm bg-white/10" />
        <div className="flex flex-1 flex-col justify-center gap-1">
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: `linear-gradient(90deg, ${option.accent}, ${option.accent2})` }} />
          <div className="h-1 w-full rounded-full bg-white/10" />
        </div>
      </div>
      {selected && <span className="absolute end-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-black"><Icon name="check" className="h-3 w-3" /></span>}
    </div>
  );
}

export function ThemeSelector({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  useLocale();
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
  const [activeTab, setActiveTab] = useState<"themes" | "sounds" | "account">("themes");
  const [uploadingSfx, setUploadingSfx] = useState<SfxName | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSfxRef = useRef<SfxName | null>(null);
  const colors = getThemeColors();
  const currentTheme = themes.find((item) => item.id === theme) ?? themes[0];
  const activeAccent = useCustomAccent ? customAccent : currentTheme.accent;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    const lockBody = window.matchMedia("(max-width: 639px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (lockBody) document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (lockBody) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleFileUpload = async (sfxName: SfxName, file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert(tr("Please select an audio file"));
      return;
    }
    setUploadingSfx(sfxName);
    try {
      await uploadCustomSound(sfxName, file);
    } catch (error) {
      alert(tr("Failed to upload sound: ") + (error as Error).message);
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

  const settingsLayer =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <>
          <button className="fixed inset-x-0 bottom-0 top-14 z-[1000] cursor-default bg-black/55 sm:top-16" onClick={() => setIsOpen(false)} aria-label={tr("Close settings")} />
          <div
            role="dialog" aria-modal="true" aria-label={tr("Preferences")}
            className={`fixed inset-x-3 top-[3.75rem] mx-auto max-w-sm max-h-[calc(100dvh-4.5rem)] z-[1010] flex min-h-0 flex-col overflow-hidden rounded-3xl border ${colors.border} shadow-2xl sm:inset-x-auto sm:bottom-auto sm:end-4 sm:top-[4.5rem] sm:mx-0 sm:w-[400px] sm:max-h-[calc(100dvh-5.5rem)]`}
            style={{
              background: "#07090d",
              boxShadow: "0 28px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.025) inset",
            }}
          >
            <div className="shrink-0 border-b border-white/10 px-3 pt-3 sm:px-4 sm:pt-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className={`text-base font-semibold ${colors.text}`}>{tr("Preferences")}</p>
                  <p className={`mt-0.5 text-xs ${colors.textSecondary}`}>{tr("Appearance, sound and account")}</p>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label={tr("Close settings")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/60 transition hover:bg-white/5 hover:text-white"><Icon name="x" className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-black/20 p-1">
                {([
                  ["themes", "palette", "Appearance"],
                  ["sounds", "volume", "Sounds"],
                  ["account", "shield", "Account"],
                ] as const).map(([id, icon, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[11px] font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${activeTab === id ? "bg-white/10 text-white shadow-sm" : `${colors.textSecondary} hover:bg-white/5 hover:text-white`}`}
                  >
                    <Icon name={icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {tr(label)}
                  </button>
                ))}
              </div>
              <div className="h-2.5" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-1">
                <span className="text-sm font-medium text-white/80">{tr("Language")}</span>
                <LanguageSelector settings />
              </div>
              <button
                type="button"
                onClick={() => { setIsOpen(false); onOpenWorkspace(); }}
                className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-start text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                {tr("My workspace")} <span aria-hidden="true">›</span>
              </button>
              {hasAndroidBridge() && <button type="button" onClick={() => { setIsOpen(false); void androidRequest("settings"); }} className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-start text-sm font-semibold text-white/85">{tr("Android unlock recaps")}<Icon name="chevronRight" className="h-4 w-4" /></button>}
              {activeTab === "themes" ? (
                <div className="space-y-3">
                  <div>
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <h3 className={`text-sm font-semibold ${colors.text}`}>{tr("Theme preset")}</h3>
                        <p className={`mt-1 text-xs ${colors.textSecondary}`}>{tr("Choose a theme or set your own accent color.")}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {themes.map((option) => {
                        const selected = !useCustomAccent && theme === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setTheme(option.id)}
                            className={`rounded-2xl border p-2 text-start transition duration-200 ${selected ? "border-white/30 bg-white/[0.07] shadow-lg" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}
                          >
                            <ThemePreview option={option} selected={selected} />
                            <div className="px-1 pb-0.5 pt-1.5">
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

                  <div className={`min-w-0 overflow-hidden rounded-2xl border p-4 transition ${useCustomAccent ? "border-white/30 bg-white/[0.06] shadow-lg" : "border-white/10 bg-black/20"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-semibold ${colors.text}`}>{tr("Custom color")}</h4>
                          {useCustomAccent && <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/70">{tr("ACTIVE")}</span>}
                        </div>
                        <p className={`mt-1 text-xs leading-5 ${colors.textSecondary}`}>{tr("Your accent color on a neutral background.")}</p>
                      </div>
                      <ToggleSwitch
                        checked={useCustomAccent}
                        onChange={() => setUseCustomAccent(!useCustomAccent)}
                        label={tr("Toggle custom color")}
                      />
                    </div>

                    <div className="mt-4 grid gap-3">
                      <button type="button" onClick={() => setColorOpen(true)} className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-start">
                        <span className="h-8 w-8 shrink-0 rounded-full border border-white/20" style={{ background: activeAccent }} />
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white/85">{tr("Choose accent color")}</span><span className="mt-1 block font-mono text-xs uppercase text-white/50">{activeAccent}</span></span>
                        <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-white/50" />
                      </button>
                      <button
                        onClick={() => { const next = randomNeonHex().toUpperCase(); setCustomAccent(next); setUseCustomAccent(true); play("notification"); }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                      >
                        <Icon name="shuffle" className="h-4 w-4" />
                        {tr("Generate accent")} </button>
                    </div>
                  </div>
                </div>
              ) : activeTab === "sounds" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <h3 className={`text-sm font-semibold ${colors.text}`}>{tr("Reward sounds")}</h3>
                      <p className={`mt-1 text-xs ${colors.textSecondary}`}>{tr("Only plays for meaningful actions.")}</p>
                    </div>
                    <ToggleSwitch
                      checked={soundEnabled}
                      onChange={() => setSoundEnabled(!soundEnabled)}
                      label={tr("Toggle reward sounds")}
                    />
                  </div>

                  {soundEnabled && (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className={`text-sm font-medium ${colors.text}`}>{tr("Volume")}</span>
                          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-white/70">{Math.round(volume * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="sw-range w-full" />
                      </div>

                      <div>
                        <h4 className={`mb-3 text-sm font-semibold ${colors.text}`}>{tr("Sound character")}</h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(SOUND_PACKS).map(([packId, pack]) => {
                            const selected = soundPack === packId;
                            return (
                              <button
                                key={packId}
                                onClick={() => { setSoundPack(packId as SoundPack); previewSound(packId as SoundPack, "success"); }}
                                className={`rounded-2xl border p-3 text-start transition ${selected ? "border-white/25 bg-white/[0.07]" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}
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
                          <h4 className={`mb-3 text-sm font-semibold ${colors.text}`}>{tr("Custom files")}</h4>
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
                                      <button onClick={() => previewSound("custom", sfx.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10 hover:text-white" title={tr("Preview")}><Icon name="play" className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => removeCustomSound(sfx.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/15 text-rose-300 hover:bg-rose-400/10" title={tr("Remove")}><Icon name="trash" className="h-3.5 w-3.5" /></button>
                                    </>
                                  ) : (
                                    <button onClick={() => triggerFileUpload(sfx.id)} disabled={uploadingSfx === sfx.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50">
                                      <Icon name="upload" className="h-3.5 w-3.5" />
                                      {uploadingSfx === sfx.id ? tr("Uploading") : tr("Upload")}
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
              ) : (
                <AccountSettingsPanel />
              )}
            </div>
          </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className={`sw-theme-hover-border group relative z-[120] flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 sm:px-3 ${colors.border} transition duration-200`}
        style={{ background: "rgba(7, 10, 14, 0.98)" }}
        title={tr("Appearance, sound and account settings")}
        aria-expanded={isOpen}
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon name="settings" className="h-4 w-4 text-white/80 transition-transform duration-300 group-hover:rotate-45" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-black/60" style={{ background: activeAccent }} />
        </span>
        <span className={`hidden text-sm font-medium sm:inline ${colors.text}`}>{tr("Customize")}</span>
        <Icon name="chevronDown" className={`hidden h-4 w-4 sm:block ${colors.textSecondary} transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      </div>
      {settingsLayer}
      {isOpen && colorOpen && <ColorWheelSheet initialHex={activeAccent} presets={themes.map(option => ({ label: option.name, hex: option.accent }))} onCancel={() => setColorOpen(false)} onSet={hex => { setCustomAccent(hex); setUseCustomAccent(true); setColorOpen(false); }} />}
    </>
  );
}
