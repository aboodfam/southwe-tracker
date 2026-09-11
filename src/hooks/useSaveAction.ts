import { useRef, useState } from "react";

export function useSaveAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn't save. Your entry is still here. Please retry."); }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, run, setError };
}
