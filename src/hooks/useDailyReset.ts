import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Triggers the server-side daily reset check.
 *
 * The mutation is idempotent, so calling it multiple times is safe.
 * This removes the browser localStorage dependency and keeps reset state
 * consistent across devices.
 */
export function useDailyReset() {
  const resetEverythingDaily = useMutation(api.daily.resetEverythingDaily);

  useEffect(() => {
    resetEverythingDaily({}).catch(() => {
      // silent (offline etc.)
    });
  }, [resetEverythingDaily]);
}
