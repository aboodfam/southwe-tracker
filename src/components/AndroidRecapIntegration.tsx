import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme, savedThemeAccent } from "../contexts/ThemeContext";
import { t as tr, useLocale } from "../i18n";
import {
  androidRequest,
  clearAndroidPairing,
  hasAndroidBridge,
  pendingAndroidPairing,
  type AndroidDeviceInfo,
} from "../lib/androidBridge";
import { useSaveAction } from "../hooks/useSaveAction";
export function AndroidRecapIntegration() {
  const locale = useLocale();
  const user = useQuery(api.auth.loggedInUser);
  const connect = useMutation(api.nativeRecaps.connectDevice);
  const { theme, useCustomAccent, customAccent } = useTheme();
  const [pairing, setPairing] = useState(() => pendingAndroidPairing());
  const [connected, setConnected] = useState(false);
  const action = useSaveAction();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!pairing || !user) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus({ preventScroll: true });
    };
  }, [pairing, user?.userId]);
  const accent = savedThemeAccent(theme, useCustomAccent, customAccent);
  const metadata = useRef({ accent, locale });
  metadata.current = { accent, locale };
  useEffect(() => {
    if (!hasAndroidBridge() || !user) return;
    let active = true;
    void (async () => {
      try {
        let info = await androidRequest<AndroidDeviceInfo>("info");
        if (info.userId && info.userId !== user.userId) {
          await androidRequest("disconnect");
          info = await androidRequest<AndroidDeviceInfo>("info");
        }
        if (!active || !/^[a-f0-9]{64}$/.test(info.tokenHash)) return;
        const data = metadata.current;
        const binding = await connect({
          tokenHash: info.tokenHash,
          label: "Ceventic Android Preview",
          accentHex: data.accent,
          locale: data.locale,
        });
        if (active)
          await androidRequest("bind", {
            ...binding,
            tokenHash: info.tokenHash,
            accentHex: data.accent,
            locale: data.locale,
          });
      } catch {
        /* Recap settings offers browser pairing and an explicit connection check. */
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.userId, theme, useCustomAccent, customAccent, locale, connect]);
  if (!pairing || !user) return null;
  const close = () => {
    clearAndroidPairing();
    setPairing(null);
  };
  return createPortal(
    <dialog
      ref={dialog}
      data-no-swipe
      className="android-pairing-dialog m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-surface p-0 text-white shadow-2xl"
      aria-label={tr("Connect Android recaps")}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <section className="w-full max-w-sm rounded-3xl border border-white/15 bg-surface p-5 text-white shadow-2xl">
        <h2 className="text-xl font-semibold">
          {tr("Connect Android recaps")}
        </h2>
        {connected ? (
          <p className="mt-4 text-sm leading-6 text-white/65">
            {tr(
              "Connected. Return to Ceventic Preview and tap Check connection.",
            )}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {tr(
                "Allow your Android app to read saved progress for day, week and month recaps. It cannot edit your tasks or account.",
              )}
            </p>
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-center font-mono text-xl tracking-widest">
              {pairing.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-3 text-xs leading-5 text-white/50">
              {tr(
                "Only connect if this code matches the device code shown in your Android app.",
              )}
            </p>
          </>
        )}
        {action.error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {action.error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            disabled={action.busy}
            onClick={close}
            className="min-h-11 flex-1 rounded-xl border border-white/15 px-3 text-sm font-semibold"
          >
            {connected ? tr("Close") : tr("Cancel")}
          </button>
          {!connected && (
            <button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await connect({
                    tokenHash: pairing,
                    label: "Android recap device",
                    accentHex: accent,
                    locale,
                  });
                  clearAndroidPairing();
                  setConnected(true);
                })
              }
              className="min-h-11 flex-1 rounded-xl bg-[image:var(--sw-gradient)] px-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              {action.busy ? tr("Connecting…") : tr("Connect device")}
            </button>
          )}
        </div>
      </section>
    </dialog>,
    document.body,
  );
}
