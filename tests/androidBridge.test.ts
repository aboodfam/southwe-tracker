import { afterEach, expect, test, vi } from "vitest";
import {
  androidRequest,
  hasAndroidBridge,
  rememberAndroidPairing,
  pendingAndroidPairing,
  clearAndroidPairing,
} from "../src/lib/androidBridge";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
test("the normal web app has no native access, and malformed or unrelated native replies cannot resolve calls", async () => {
  expect(hasAndroidBridge()).toBe(false);
  await expect(androidRequest("info")).rejects.toThrow(/unavailable/);
  const native: {
    postMessage: (raw: string) => void;
    onmessage: null | ((event: { data: string }) => void);
  } = {
    onmessage: null,
    postMessage: (raw) => {
      const call = JSON.parse(raw);
      native.onmessage?.({ data: "not json" });
      native.onmessage?.({
        data: JSON.stringify({ id: "wrong", result: "wrong" }),
      });
      queueMicrotask(() =>
        native.onmessage?.({
          data: JSON.stringify({
            id: call.id,
            result: { tokenHash: "a".repeat(64) },
          }),
        }),
      );
    },
  };
  vi.stubGlobal("window", { CeventicAndroid: native });
  expect(hasAndroidBridge()).toBe(true);
  expect(await androidRequest("info")).toEqual({ tokenHash: "a".repeat(64) });
});
test("browser pairing survives sign-in redirects temporarily and clears only its own parameter", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  const state = {
    href: `https://ceventic.vercel.app/?ceventicAndroidDevice=${"a".repeat(64)}&other=keep`,
  };
  const replaceState = vi.fn((_state: unknown, _title: string, url: URL) => {
    state.href = url.toString();
  });
  vi.stubGlobal("window", {
    location: state,
    history: { state: null, replaceState },
  });
  rememberAndroidPairing();
  state.href = "https://ceventic.vercel.app/";
  expect(pendingAndroidPairing()).toBe("a".repeat(64));
  vi.advanceTimersByTime(11 * 60000);
  expect(pendingAndroidPairing()).toBeNull();
  state.href = `https://ceventic.vercel.app/?ceventicAndroidDevice=${"a".repeat(64)}&other=keep`;
  clearAndroidPairing();
  expect(state.href).toBe("https://ceventic.vercel.app/?other=keep");
  state.href = "https://ceventic.vercel.app/?ceventicAndroidDevice=invalid";
  rememberAndroidPairing();
  expect(pendingAndroidPairing()).toBeNull();
});
