export type AndroidDeviceInfo = {
  version: number;
  tokenHash: string;
  userId: string;
  expiresAt: number;
  enabled: boolean;
  label: string;
};
type NativeApi = {
  postMessage: (message: string) => void;
  onmessage: ((event: { data: string }) => void) | null;
};
declare global {
  interface Window {
    CeventicAndroid?: NativeApi;
  }
}
const pending = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
let installed: NativeApi | undefined;
export function hasAndroidBridge() {
  return (
    typeof window !== "undefined" &&
    typeof window.CeventicAndroid?.postMessage === "function"
  );
}
export function androidRequest<T = unknown>(
  method: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const api =
    typeof window !== "undefined" ? window.CeventicAndroid : undefined;
  if (!api) return Promise.reject(new Error("Android integration unavailable"));
  if (installed !== api) {
    installed = api;
    api.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const call = pending.get(response.id);
        if (!call) return;
        clearTimeout(call.timer);
        pending.delete(response.id);
        if (typeof response.error === "string")
          call.reject(new Error(response.error));
        else call.resolve(response.result);
      } catch {
        /* Ignore malformed or unrelated native messages. */
      }
    };
  }
  const id = crypto.randomUUID();
  if (method === "settings") {
    api.postMessage(JSON.stringify({ id, method, data }));
    return Promise.resolve({} as T);
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Android connection timed out"));
    }, 10000);
    pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
    try {
      api.postMessage(JSON.stringify({ id, method, data }));
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}
export async function disconnectAndroid(
  revoke?: (args: { tokenHash: string }) => Promise<unknown>,
) {
  if (!hasAndroidBridge()) return;
  try {
    const info = await androidRequest<AndroidDeviceInfo>("info");
    if (revoke) await revoke({ tokenHash: info.tokenHash });
  } catch {
    /* Local key removal must still run if the server is offline. */
  }
  await androidRequest("disconnect").catch(() => {});
}
const PENDING_KEY = "ceventic_android_pairing";
export function rememberAndroidPairing() {
  if (typeof window === "undefined") return;
  const hash = new URL(window.location.href).searchParams.get(
    "ceventicAndroidDevice",
  );
  if (hash && /^[a-f0-9]{64}$/.test(hash)) {
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ hash, at: Date.now() }),
      );
    } catch {}
  }
}
export function pendingAndroidPairing(): string | null {
  if (typeof window === "undefined") return null;
  const direct = new URL(window.location.href).searchParams.get(
    "ceventicAndroidDevice",
  );
  if (direct && /^[a-f0-9]{64}$/.test(direct)) return direct;
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
    if (
      saved &&
      /^[a-f0-9]{64}$/.test(saved.hash) &&
      Date.now() - saved.at < 10 * 60000
    )
      return saved.hash;
  } catch {}
  return null;
}
export function clearAndroidPairing() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.delete("ceventicAndroidDevice");
  window.history.replaceState(window.history.state, "", url);
}
