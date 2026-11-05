import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type QuietMode = {
  quiet: boolean;
  saving: boolean;
  error: boolean;
  setQuiet: (quiet: boolean) => Promise<void>;
};
const QuietModeContext = createContext<QuietMode>({
  quiet: false,
  saving: false,
  error: false,
  setQuiet: async () => {},
});

/** Preview immediately, keep the latest choice while syncing, and isolate account changes. */
export function QuietModeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const preferences = useQuery(
    api.workspace.getPreferences,
    isAuthenticated ? {} : "skip",
  );
  const save = useMutation(api.workspace.setQuietMode);
  const [choice, setChoice] = useState<{
    userId: string;
    quiet: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const userId = preferences?.userId;
  const account = useRef(userId);
  account.current = userId;
  const quiet =
    choice && choice.userId === userId
      ? choice.quiet
      : (preferences?.quiet ?? false);

  useEffect(() => {
    document.documentElement.dataset.ceventicQuiet = String(quiet);
    return () => {
      delete document.documentElement.dataset.ceventicQuiet;
    };
  }, [quiet]);
  useEffect(() => {
    if (
      !saving &&
      choice?.userId === userId &&
      choice?.quiet === preferences?.quiet
    )
      setChoice(null);
  }, [saving, choice, userId, preferences?.quiet]);
  useEffect(() => {
    request.current += 1;
    setChoice(null);
    setSaving(false);
    setError(false);
  }, [userId]);

  const setQuiet = async (next: boolean) => {
    if (!userId) return;
    const version = ++request.current;
    setChoice({ userId, quiet: next });
    setSaving(true);
    setError(false);
    try {
      await save({ quiet: next });
    } catch {
      if (version === request.current && account.current === userId) {
        setChoice(null);
        setError(true);
      }
    } finally {
      if (version === request.current && account.current === userId)
        setSaving(false);
    }
  };
  return (
    <QuietModeContext.Provider value={{ quiet, saving, error, setQuiet }}>
      {children}
    </QuietModeContext.Provider>
  );
}
export const useQuietMode = () => useContext(QuietModeContext);
