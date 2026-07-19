import { useState, useRef } from "react";
import { useTheme, Theme } from "../contexts/ThemeContext";
import { useSound, SOUND_PACKS, SfxName, SoundPack } from "../contexts/SoundContext";

const themes: { id: Theme; name: string; icon: string; preview: string }[] = [
  { id: "cyan", name: "Cyan", icon: "🌊", preview: "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500" },
  { id: "white", name: "Light", icon: "☀️", preview: "bg-gradient-to-r from-slate-100 via-sky-100 to-white" },
  { id: "black", name: "Dark", icon: "🌙", preview: "bg-gradient-to-r from-slate-700 via-zinc-800 to-black" },
  { id: "red", name: "Red", icon: "🔥", preview: "bg-gradient-to-r from-rose-600 via-red-600 to-orange-500" },
  { id: "purple", name: "Purple", icon: "🔮", preview: "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500" },
  { id: "green", name: "Green", icon: "🌿", preview: "bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500" },
];

function randomNeonHex() {
  // Vibrant neon range with pleasing hue distribution
  const hue = (Math.random() * 360 + 137.508) % 360;
  const s = 0.92;
  const l = 0.55;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let rr = 0, gg = 0, bb = 0;
  if (hue < 60) { rr = c; gg = x; bb = 0; }
  else if (hue < 120) { rr = x; gg = c; bb = 0; }
  else if (hue < 180) { rr = 0; gg = c; bb = x; }
  else if (hue < 240) { rr = 0; gg = x; bb = c; }
  else if (hue < 300) { rr = x; gg = 0; bb = c; }
  else { rr = c; gg = 0; bb = x; }

  const r = Math.round((rr + m) * 255);
  const g = Math.round((gg + m) * 255);
  const b = Math.round((bb + m) * 255);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


// Only show the reward sounds your app actually uses (so "Custom" stays clean and focused).
const soundEffectNames: { id: SfxName; name: string; description: string }[] = [
  { id: "notification", name: "Created", description: "Adding things" },
  { id: "success", name: "Completed", description: "Finishing items" },
  { id: "complete", name: "Big Win", description: "Workout/day complete" },
];

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
    previewSound
  } = useSound();
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"themes" | "sounds">("themes");
  const [uploadingSfx, setUploadingSfx] = useState<SfxName | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = getThemeColors();

  const currentTheme = themes.find((t) => t.id === theme);

  const handleFileUpload = async (sfxName: SfxName, file: File) => {
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    setUploadingSfx(sfxName);
    try {
      await uploadCustomSound(sfxName, file);
      alert('Sound uploaded successfully!');
    } catch (error) {
      alert('Failed to upload sound: ' + (error as Error).message);
    } finally {
      setUploadingSfx(null);
    }
  };

  const triggerFileUpload = (sfxName: SfxName) => {
    setUploadingSfx(sfxName);
    if (fileInputRef.current) {
      fileInputRef.current.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleFileUpload(sfxName, file);
        }
        setUploadingSfx(null);
      };
      fileInputRef.current.click();
    }
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 sm:p-3 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${colors.border} ${colors.backgroundSecondary} backdrop-blur-sm ${colors.shadow} hover:${colors.borderHover}`}
        title="Settings"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl">{currentTheme?.icon}</span>
          <span className={`hidden sm:inline text-sm font-medium ${colors.text}`}>
            Settings
          </span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${colors.text} ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div
            className={`absolute top-full right-0 mt-2 ${colors.backgroundSecondary} backdrop-blur-xl border ${colors.border} rounded-2xl shadow-2xl ${colors.shadow} z-[100] w-[320px] sm:w-[400px] max-h-[80vh] overflow-hidden`}
          >
            {/* Tab Headers */}
            <div className={`flex border-b border-white/10 bg-black/50 backdrop-blur-xl`}>
              <button
                onClick={() => setActiveTab("themes")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all hover:bg-white/5 ${
                  activeTab === "themes"
                    ? `${colors.text} border-b-2 border-current bg-black/30`
                    : `${colors.textSecondary} hover:${colors.text}`
                }`}
              >
                🎨 Themes
              </button>
              <button
                onClick={() => setActiveTab("sounds")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all hover:bg-white/5 ${
                  activeTab === "sounds"
                    ? `${colors.text} border-b-2 border-current bg-black/30`
                    : `${colors.textSecondary} hover:${colors.text}`
                }`}
              >
                🔊 Sounds
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {activeTab === "themes" ? (
                <div className="space-y-4">
                  <h3 className={`text-lg font-bold ${colors.text} text-center`}>Choose Theme</h3>

                  <div className="grid grid-cols-2 gap-3">
                    {themes.map((themeOption) => (
                      <button
                        key={themeOption.id}
                        onClick={() => {
                          setTheme(themeOption.id);
                        }}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 backdrop-blur-md ${
                          theme === themeOption.id
                            ? `${colors.border} ${colors.shadow} bg-black/60 ring-1 ring-white/10`
                            : "border-white/15 hover:border-white/25 bg-black/55"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl">{themeOption.icon}</span>
                          <span className={`text-sm font-medium ${theme === themeOption.id ? colors.text : "text-gray-300"}`}>
                            {themeOption.name}
                          </span>
                          <div className={`w-full h-2 rounded-full ${themeOption.preview}`} />
                        </div>

                        {theme === themeOption.id && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-emerald-400 to-lime-300 rounded-full flex items-center justify-center">
                            <span className="text-black text-xs font-bold">✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>


<div className={`rounded-2xl border ${colors.border} ${colors.backgroundSecondary} backdrop-blur-md p-4`}>
  <div className="flex items-start justify-between gap-4">
    <div>
      <h4 className={`text-sm font-semibold ${colors.text}`}>Accent Color</h4>
      <p className={`text-xs ${colors.textSecondary} mt-1`}>
        Pick any color you like. When enabled, it upgrades the app glow + gradients to a custom neon style.
      </p>
    </div>
    <button
      onClick={() => setUseCustomAccent(!useCustomAccent)}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
        useCustomAccent
          ? "bg-white/10 border-white/20 text-white"
          : "bg-black/30 border-white/10 text-white/70 hover:text-white"
      }`}
    >
      {useCustomAccent ? "On" : "Off"}
    </button>
  </div>

  <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
    <div className={`flex items-center gap-3 rounded-xl border ${colors.border} ${colors.backgroundTertiary} p-3`}>
      <input
        type="color"
        value={customAccent}
        onChange={(e) => setCustomAccent(e.target.value)}
        disabled={!useCustomAccent}
        className="h-10 w-12 rounded-lg bg-transparent border-0 p-0"
        aria-label="Pick accent color"
      />
      <input
        type="text"
        value={customAccent}
        onChange={(e) => setCustomAccent(e.target.value)}
        disabled={!useCustomAccent}
        className={`w-28 sm:w-32 bg-transparent outline-none text-sm ${colors.text} placeholder:text-white/40`}
        placeholder="#00ccff"
        spellCheck={false}
      />
    </div>

    <button
      onClick={() => {
        setCustomAccent(randomNeonHex());
        setUseCustomAccent(true);
        play("notification");
      }}
      className={`px-4 py-3 rounded-xl text-sm font-semibold border ${colors.border} ${colors.backgroundTertiary} ${colors.text} hover:brightness-110 transition-all`}
    >
      🎲 Random Neon
    </button>

    <div className="flex-1">
      <div className="h-10 rounded-xl border border-white/10 bg-black/30 flex items-center px-3">
        <div className="h-2 w-full rounded-full bg-[image:var(--sw-gradient)] opacity-90" />
      </div>
    </div>
  </div>
</div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className={`text-lg font-bold ${colors.text} text-center`}>Sound Settings</h3>
                  
                  {/* Enable/Disable Sounds */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${colors.textSecondary}`}>Enable Sounds</span>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                        soundEnabled ? `bg-gradient-to-r ${colors.gradient}` : "bg-gray-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                          soundEnabled ? "translate-x-6" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {soundEnabled && (
                    <>
                      {/* Volume Control */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${colors.textSecondary}`}>Volume</span>
                          <span className={`text-sm ${colors.text}`}>{Math.round(volume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>

                      {/* Sound Pack Selection */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${colors.text}`}>Sound Pack</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(SOUND_PACKS).map(([packId, pack]) => (
                            <button
                              key={packId}
                              onClick={() => {
                                setSoundPack(packId as SoundPack);
                                // Preview a reward sound (the app no longer uses global click sounds).
                                previewSound(packId as SoundPack, "success");
                              }}
                              className={`p-3 rounded-xl border transition-all text-left backdrop-blur-md ${
                                soundPack === packId
                                  ? `${colors.border} bg-black/60 ring-1 ring-white/10`
                                  : "border-white/15 hover:border-white/25 bg-black/55"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span>{pack.icon}</span>
                                <span className={`text-sm font-medium ${soundPack === packId ? colors.text : "text-gray-300"}`}>
                                  {pack.name}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">{pack.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Sound Upload */}
                      {soundPack === "custom" && (
                        <div className="space-y-3">
                          <h4 className={`text-sm font-semibold ${colors.text}`}>Custom Sounds</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {soundEffectNames.map((sfx) => (
                              <div key={sfx.id} className={`flex items-center justify-between p-3 rounded-xl border border-white/10 bg-black/55 backdrop-blur-md`}>
                                <div className="flex-1">
                                  <div className={`text-sm font-medium ${colors.text}`}>{sfx.name}</div>
                                  <div className="text-xs text-gray-400">{sfx.description}</div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {customSounds[sfx.id] ? (
                                    <>
                                      <button
                                        onClick={() => previewSound("custom", sfx.id)}
                                        className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                        title="Preview"
                                      >
                                        ▶️
                                      </button>
                                      <button
                                        onClick={() => removeCustomSound(sfx.id)}
                                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                        title="Remove"
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => triggerFileUpload(sfx.id)}
                                      disabled={uploadingSfx === sfx.id}
                                      className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                                    >
                                      {uploadingSfx === sfx.id ? "..." : "Upload"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                          />
                          
                          <p className="text-xs text-gray-500 mt-2">
                            Upload .mp3, .wav, or .ogg files for custom sound effects
                          </p>
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
