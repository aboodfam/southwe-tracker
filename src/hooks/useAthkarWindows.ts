import { useEffect, useState } from "react";
import { getAthkarWindowKey, SCHEDULED_ATHKAR_STARTS, type ScheduledAthkarCategory } from "../lib/athkarSchedule";
const categories = Object.keys(SCHEDULED_ATHKAR_STARTS) as ScheduledAthkarCategory[];
function signature() { return categories.map(category => getAthkarWindowKey(category)).join("|"); }
/** Refresh at category boundaries and after the app returns from the background. */
export function useAthkarWindows() {
  const [value, setValue] = useState(signature);
  useEffect(() => {
    const refresh = () => setValue(signature());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return Object.fromEntries(categories.map((category, index) => [category, value.split("|")[index]])) as Record<ScheduledAthkarCategory, string>;
}
