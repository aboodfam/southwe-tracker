import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";

const DEVICE_TOKEN_KEY = "ceventic_trusted_device_token";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function deviceLabel() {
  if (isTauri()) return "Ceventic for Windows";
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return "Mobile browser";
  return "Desktop browser";
}

function getOrCreateDeviceToken() {
  const current = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (current && current.length >= 32) return current;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  const token = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function TrustedDeviceGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuthActions();
  const requestCode = useAction(api.deviceAuth.requestDeviceCode);
  const verifyCode = useAction(api.deviceAuth.verifyDeviceCode);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [deviceHash, setDeviceHash] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const label = useMemo(() => (typeof navigator === "undefined" ? "This device" : deviceLabel()), []);

  useEffect(() => {
    const token = getOrCreateDeviceToken();
    setDeviceToken(token);
    void sha256Hex(token).then(setDeviceHash);
  }, []);

  const trust = useQuery(api.deviceAuth.getDeviceTrust, deviceHash ? { deviceHash } : "skip");

  const send = async (manual = false) => {
    if (!deviceHash || sending) return;
    setSending(true);
    try {
      const result = await requestCode({ deviceHash, label });
      setMaskedEmail(result.maskedEmail);
      sessionStorage.setItem(`ceventic_device_code_sent:${deviceHash}`, "1");
      if (manual) toast.success("A new security code was sent");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not send the security code");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!deviceHash || trust === undefined || !trust.enabled || trust.trusted) return;
    const key = `ceventic_device_code_sent:${deviceHash}`;
    if (sessionStorage.getItem(key)) return;
    const timer = window.setTimeout(() => void send(false), 300);
    return () => window.clearTimeout(timer);
    // send is intentionally not a dependency: this effect is one automatic send per device/session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceHash, trust?.enabled, trust?.trusted]);

  if (!deviceHash || trust === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-black">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
      </div>
    );
  }

  if (!trust.enabled || trust.trusted) return <>{children}</>;

  const verify = async () => {
    if (!deviceToken || verifying || code.length !== 6) return;
    setVerifying(true);
    try {
      await verifyCode({ code, deviceToken, label });
      toast.success("Device verified for 30 days");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not verify this device");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="relative z-20 min-h-screen bg-black px-4 py-8 text-white sm:grid sm:place-items-center">
      <div className="mx-auto w-full max-w-md pt-[10vh] sm:pt-0">
        <div className="mb-7 flex items-center gap-3 text-white/45">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">Security check</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#090909] p-5 shadow-[0_24px_80px_rgba(0,0,0,.55)] sm:p-7">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.035]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Verify this device</h1>
          <p className="mt-2 text-sm leading-6 text-white/48">
            {maskedEmail ? <>We sent a 6-digit code to <span className="font-semibold text-white/70">{maskedEmail}</span>.</> : "We’re sending a 6-digit code to your account email."} This device will stay trusted for 30 days.
          </p>

          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(event) => { if (event.key === "Enter") void verify(); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="mt-6 w-full rounded-2xl border border-white/12 bg-black px-4 py-4 text-center text-2xl font-bold tracking-[0.32em] text-white outline-none transition focus:border-white/30"
          />

          <button
            onClick={() => void verify()}
            disabled={verifying || code.length !== 6}
            className="mt-3 w-full rounded-2xl bg-[image:var(--sw-gradient)] px-4 py-3.5 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {verifying ? "Checking…" : "Verify device"}
          </button>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs">
            <button onClick={() => void send(true)} disabled={sending} className="text-white/50 transition hover:text-white disabled:opacity-40">
              {sending ? "Sending…" : "Resend code"}
            </button>
            <button onClick={() => void signOut()} className="text-white/40 transition hover:text-white">Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
