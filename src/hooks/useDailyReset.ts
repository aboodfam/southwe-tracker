import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalDateKey } from "./useLocalDateKey";

/**
 * Triggers the server-side daily reset check.
 *
 * The mutation is idempotent, so calling it multiple times is safe.
 * This removes the browser localStorage dependency and keeps reset state
 * consistent across devices.
 */
export function useDailyReset(enabled = true) {
  const resetEverythingDaily = useMutation(api.daily.resetEverythingDaily);
  const dateKey = useLocalDateKey();

  useEffect(() => {
    if (!enabled) return;
    resetEverythingDaily({ dateKey }).catch(() => {
      // silent (offline etc.)
    });
  }, [enabled, dateKey, resetEverythingDaily]);
}
