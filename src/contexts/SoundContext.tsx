import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Reward-only sound system
 * - No global click/change listeners
 * - Sounds only play when the app explicitly calls `play(...)`
 * - "Custom" supports uploading 3 reward sounds (Created/Completed/Big Win)
 */

export type SfxName = "notification" | "success" | "complete";

export type SoundPack =
  | "neon"
  | "arcade"
  | "cinematic"
  | "lofi"
  | "crystal"
  | "custom";

export const SOUND_PACKS: Record<
  Exclude<SoundPack, "custom"> | "custom",
  { name: string; description: string }
> = {
  neon: {
    name: "Neon",
    description: "Clean cyber chimes — modern and satisfying",
  },
  arcade: {
    name: "Arcade",
    description: "Retro game feel — punchy + fun rewards",
  },
  cinematic: {
    name: "Cinematic",
    description: "Bigger wins — soft bass + airy sparkle",
  },
  lofi: {
    name: "Lo‑Fi",
    description: "Warm and subtle — rewarding without being loud",
  },
  crystal: {
    name: "Crystal",
    description: "Bright bells — premium, shiny and clear",
  },
  custom: {
    name: "Custom",
    description: "Upload your own reward sounds",
  },
};

type CustomSound = {
  dataUrl: string; // base64 DataURL
  updatedAt: number;
};

type SoundContextValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;

  volume: number;
  setVolume: (v: number) => void;

  soundPack: SoundPack;
  setSoundPack: (p: SoundPack) => void;

  customSounds: Partial<Record<SfxName, CustomSound>>;
  uploadCustomSound: (sfx: SfxName, file: File) => Promise<void>;
  removeCustomSound: (sfx: SfxName) => void;

  play: (sfx: SfxName, gainBoost?: number) => void;
  previewSound: (pack: SoundPack, sfx: SfxName) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

const LS_ENABLED = "sw_sound_enabled_v2";
const LS_VOLUME = "sw_sound_volume_v2";
const LS_PACK = "sw_sound_pack_v2";
const LS_CUSTOM = "sw_custom_sounds_v2";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hasKey<T extends Record<string, any>>(obj: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    const raw = localStorage.getItem(LS_ENABLED);
    if (raw === null) return true;
    return raw === "true";
  });

  const [volume, setVolumeState] = useState<number>(() => {
    const raw = localStorage.getItem(LS_VOLUME);
    const v = raw ? Number(raw) : 0.85;
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0.85;
  });

  const [soundPack, setSoundPackState] = useState<SoundPack>(() => {
    const raw = localStorage.getItem(LS_PACK);
    if (!raw) return "neon";
    if (raw === "sharp" || raw === "minimal") return "neon"; // migrate old values
    if (hasKey(SOUND_PACKS, raw)) return raw as SoundPack;
    return "neon";
  });

  const [customSounds, setCustomSounds] = useState<Partial<Record<SfxName, CustomSound>>>(() => {
    const data = safeParseJSON<Partial<Record<SfxName, CustomSound>>>(localStorage.getItem(LS_CUSTOM));
    return data ?? {};
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_ENABLED, String(enabled));
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem(LS_VOLUME, String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(LS_PACK, soundPack);
  }, [soundPack]);

  useEffect(() => {
    localStorage.setItem(LS_CUSTOM, JSON.stringify(customSounds));
  }, [customSounds]);

  // WebAudio single context
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;

    if (!audioCtxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtxRef.current = new Ctx();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.value = 1;
      masterGainRef.current.connect(audioCtxRef.current.destination);
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return null;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    return ctx;
  }, []);

  // Unlock audio once (without playing anything)
  useEffect(() => {
    let done = false;
    const unlock = async () => {
      if (done) return;
      done = true;
      const ctx = await ensureAudio();
      if (!ctx) return;

      // tiny silent tick to satisfy some browsers
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g);
      g.connect(masterGainRef.current!);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.01);
    };

    const handler = () => unlock();
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [ensureAudio]);

  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
  const setVolume = useCallback((v: number) => setVolumeState(clamp(v, 0, 1)), []);

  const setSoundPack = useCallback((p: SoundPack) => {
    if (hasKey(SOUND_PACKS, p)) setSoundPackState(p);
    else setSoundPackState("neon");
  }, []);

  // ---------- Sound synthesis helpers ----------
  const connectToMaster = useCallback((node: AudioNode) => {
    if (!masterGainRef.current) return;
    node.connect(masterGainRef.current);
  }, []);

  const makeGain = (ctx: AudioContext, level: number) => {
    const g = ctx.createGain();
    g.gain.value = level;
    return g;
  };

  const env = (
    g: GainNode,
    ctx: AudioContext,
    t: number,
    a: number,
    d: number,
    s: number,
    r: number,
    peak: number
  ) => {
    // Attack -> decay -> sustain -> release
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  };

  const osc = (
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur);
    return o;
  };

  const noiseBuffer = (ctx: AudioContext, seconds: number) => {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    return buffer;
  };

  const playNeon = (ctx: AudioContext, sfx: SfxName, gain: number) => {
    const t = ctx.currentTime + 0.01;

    // Neon = clean sine+triangle with a tiny sparkle layer
    const out = makeGain(ctx, gain);
    connectToMaster(out);

    const sparkle = (start: number, f: number, dur: number, amp: number) => {
      const o = osc(ctx, "sine", f, start, dur);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, start, 0.006, 0.09, 0.25, 0.15, amp);
      o.connect(g);
      g.connect(out);
    };

    if (sfx === "notification") {
      sparkle(t, 740, 0.18, 0.35);
      sparkle(t + 0.03, 980, 0.16, 0.25);
    } else if (sfx === "success") {
      sparkle(t, 660, 0.20, 0.35);
      sparkle(t + 0.05, 880, 0.18, 0.30);
      sparkle(t + 0.10, 990, 0.16, 0.25);
    } else {
      // complete
      sparkle(t, 523.25, 0.35, 0.30);
      sparkle(t + 0.04, 659.25, 0.35, 0.26);
      sparkle(t + 0.08, 783.99, 0.35, 0.22);

      // airy shimmer
      const nb = noiseBuffer(ctx, 0.35);
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(2200, t);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, t, 0.01, 0.10, 0.20, 0.25, 0.12);
      ns.connect(hp);
      hp.connect(g);
      g.connect(out);
      ns.start(t);
      ns.stop(t + 0.35);
    }
  };

  const playArcade = (ctx: AudioContext, sfx: SfxName, gain: number) => {
    const t = ctx.currentTime + 0.01;
    const out = makeGain(ctx, gain);
    connectToMaster(out);

    const blip = (start: number, f1: number, f2: number, dur: number, amp: number) => {
      const o = osc(ctx, "square", f1, start, dur);
      o.frequency.exponentialRampToValueAtTime(f2, start + dur);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, start, 0.002, 0.06, 0.15, 0.10, amp);
      o.connect(g);
      g.connect(out);
    };

    if (sfx === "notification") {
      blip(t, 600, 900, 0.10, 0.35);
      blip(t + 0.08, 400, 650, 0.10, 0.25);
    } else if (sfx === "success") {
      blip(t, 520, 880, 0.12, 0.35);
      blip(t + 0.10, 660, 1100, 0.12, 0.30);
      blip(t + 0.20, 880, 1320, 0.12, 0.25);
    } else {
      // complete = "coin shower"
      blip(t, 660, 1320, 0.14, 0.32);
      blip(t + 0.12, 880, 1760, 0.14, 0.28);
      blip(t + 0.24, 990, 1980, 0.14, 0.24);

      // tiny kick
      const o = osc(ctx, "sine", 90, t, 0.18);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, t, 0.002, 0.05, 0.15, 0.12, 0.12);
      o.connect(g);
      g.connect(out);
    }
  };

  const playCinematic = (ctx: AudioContext, sfx: SfxName, gain: number) => {
    const t = ctx.currentTime + 0.01;
    const out = makeGain(ctx, gain);
    connectToMaster(out);

    const tone = (start: number, f: number, dur: number, amp: number, type: OscillatorType = "triangle") => {
      const o = osc(ctx, type, f, start, dur);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, start, 0.012, 0.18, 0.40, 0.25, amp);
      o.connect(g);
      g.connect(out);
    };

    if (sfx === "notification") {
      tone(t, 440, 0.30, 0.25);
      tone(t + 0.06, 659.25, 0.28, 0.20, "sine");
    } else if (sfx === "success") {
      tone(t, 392, 0.35, 0.22);
      tone(t + 0.05, 587.33, 0.33, 0.18, "sine");
      tone(t + 0.10, 783.99, 0.30, 0.16, "sine");
    } else {
      // complete = warm chord + soft sub
      tone(t, 261.63, 0.60, 0.22);
      tone(t + 0.02, 329.63, 0.60, 0.18);
      tone(t + 0.04, 392.00, 0.60, 0.16);

      const sub = osc(ctx, "sine", 55, t, 0.50);
      const sg = makeGain(ctx, 0.0001);
      env(sg, ctx, t, 0.01, 0.10, 0.30, 0.30, 0.12);
      sub.connect(sg);
      sg.connect(out);

      // airy sparkle sweep
      const nb = noiseBuffer(ctx, 0.55);
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1000, t);
      bp.frequency.linearRampToValueAtTime(2600, t + 0.55);
      bp.Q.setValueAtTime(0.7, t);

      const g = makeGain(ctx, 0.0001);
      env(g, ctx, t, 0.02, 0.18, 0.25, 0.35, 0.10);
      ns.connect(bp);
      bp.connect(g);
      g.connect(out);
      ns.start(t);
      ns.stop(t + 0.55);
    }
  };

  const playLofi = (ctx: AudioContext, sfx: SfxName, gain: number) => {
    const t = ctx.currentTime + 0.01;
    const out = makeGain(ctx, gain);
    connectToMaster(out);

    // lo-fi = mellow plucks + lowpass
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.Q.setValueAtTime(0.6, t);
    lp.connect(out);

    const pluck = (start: number, f: number, dur: number, amp: number) => {
      const o = osc(ctx, "triangle", f, start, dur);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, start, 0.008, 0.14, 0.30, 0.22, amp);
      o.connect(g);
      g.connect(lp);
    };

    if (sfx === "notification") {
      pluck(t, 392, 0.28, 0.26);
      pluck(t + 0.06, 523.25, 0.26, 0.18);
    } else if (sfx === "success") {
      pluck(t, 440, 0.30, 0.24);
      pluck(t + 0.08, 587.33, 0.28, 0.20);
      pluck(t + 0.16, 659.25, 0.26, 0.16);
    } else {
      pluck(t, 261.63, 0.55, 0.22);
      pluck(t + 0.05, 329.63, 0.55, 0.18);
      pluck(t + 0.10, 392.00, 0.55, 0.14);
      pluck(t + 0.18, 523.25, 0.45, 0.10);
    }
  };

  const playCrystal = (ctx: AudioContext, sfx: SfxName, gain: number) => {
    const t = ctx.currentTime + 0.01;
    const out = makeGain(ctx, gain);
    connectToMaster(out);

    // crystal = bell-ish FM tones
    const bell = (start: number, base: number, dur: number, amp: number) => {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(base, start);

      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.setValueAtTime(base * 2.02, start);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(base * 0.45, start);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const g = makeGain(ctx, 0.0001);
      env(g, ctx, start, 0.004, 0.25, 0.35, 0.40, amp);

      carrier.connect(g);
      g.connect(out);

      carrier.start(start);
      mod.start(start);
      carrier.stop(start + dur);
      mod.stop(start + dur);
    };

    if (sfx === "notification") {
      bell(t, 784, 0.35, 0.26);
      bell(t + 0.05, 1046.5, 0.30, 0.18);
    } else if (sfx === "success") {
      bell(t, 659.25, 0.45, 0.24);
      bell(t + 0.08, 880, 0.40, 0.18);
      bell(t + 0.16, 1174.7, 0.35, 0.14);
    } else {
      // complete = chord sparkle
      bell(t, 523.25, 0.70, 0.18);
      bell(t + 0.02, 659.25, 0.70, 0.16);
      bell(t + 0.04, 783.99, 0.70, 0.14);
      bell(t + 0.10, 1046.5, 0.55, 0.10);

      // glassy shimmer
      const nb = noiseBuffer(ctx, 0.6);
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(2800, t);
      const g = makeGain(ctx, 0.0001);
      env(g, ctx, t, 0.02, 0.12, 0.25, 0.40, 0.10);
      ns.connect(hp);
      hp.connect(g);
      g.connect(out);
      ns.start(t);
      ns.stop(t + 0.6);
    }
  };

  const playPack = useCallback(
    async (pack: SoundPack, sfx: SfxName, gain: number) => {
      const ctx = await ensureAudio();
      if (!ctx) return;

      const g = clamp(gain, 0, 2);

      if (pack === "custom") {
        const custom = customSounds[sfx];
        if (!custom?.dataUrl) return;

        try {
          const res = await fetch(custom.dataUrl);
          const arr = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr.slice(0));

          const src = ctx.createBufferSource();
          src.buffer = buf;

          const out = makeGain(ctx, g);
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-18, ctx.currentTime);
          comp.knee.setValueAtTime(20, ctx.currentTime);
          comp.ratio.setValueAtTime(3, ctx.currentTime);
          comp.attack.setValueAtTime(0.003, ctx.currentTime);
          comp.release.setValueAtTime(0.12, ctx.currentTime);

          src.connect(comp);
          comp.connect(out);
          connectToMaster(out);

          src.start(ctx.currentTime + 0.01);
          src.stop(ctx.currentTime + 0.01 + buf.duration);
        } catch {
          // ignore decode errors
        }
        return;
      }

      switch (pack) {
        case "neon":
          playNeon(ctx, sfx, g);
          break;
        case "arcade":
          playArcade(ctx, sfx, g);
          break;
        case "cinematic":
          playCinematic(ctx, sfx, g);
          break;
        case "lofi":
          playLofi(ctx, sfx, g);
          break;
        case "crystal":
          playCrystal(ctx, sfx, g);
          break;
      }
    },
    [ensureAudio, connectToMaster, customSounds]
  );

  const play = useCallback(
    (sfx: SfxName, gainBoost: number = 1) => {
      if (!enabled) return;
      const g = clamp(volume * gainBoost, 0, 2);
      playPack(soundPack, sfx, g);
    },
    [enabled, volume, soundPack, playPack]
  );

  const previewSound = useCallback(
    (pack: SoundPack, sfx: SfxName) => {
      const g = clamp(volume * 1.0, 0, 2);
      playPack(pack, sfx, g);
    },
    [volume, playPack]
  );

  const uploadCustomSound = useCallback(async (sfx: SfxName, file: File) => {
    // Keep it safe and fast
    const maxBytes = 1_500_000; // 1.5MB
    if (file.size > maxBytes) {
      throw new Error("File too large. Use a short sound under 1.5MB.");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

    setCustomSounds((prev) => ({
      ...prev,
      [sfx]: { dataUrl, updatedAt: Date.now() },
    }));
  }, []);

  const removeCustomSound = useCallback((sfx: SfxName) => {
    setCustomSounds((prev) => {
      const next = { ...prev };
      delete (next as any)[sfx];
      return next;
    });
  }, []);

  const value: SoundContextValue = useMemo(
    () => ({
      enabled,
      setEnabled,
      volume,
      setVolume,
      soundPack,
      setSoundPack,
      customSounds,
      uploadCustomSound,
      removeCustomSound,
      play,
      previewSound,
    }),
    [
      enabled,
      setEnabled,
      volume,
      setVolume,
      soundPack,
      setSoundPack,
      customSounds,
      uploadCustomSound,
      removeCustomSound,
      play,
      previewSound,
    ]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
