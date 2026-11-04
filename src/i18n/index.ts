import { useSyncExternalStore } from "react";
import ar from "./ar.json";
import es from "./es.json";
import fr from "./fr.json";
import zh from "./zh.json";

export const LANGUAGES = [
  { code: "en", name: "English", direction: "ltr" },
  { code: "ar", name: "العربية", direction: "rtl" },
  { code: "es", name: "Español", direction: "ltr" },
  { code: "fr", name: "Français", direction: "ltr" },
  { code: "zh", name: "简体中文", direction: "ltr" },
] as const;
export type Locale = (typeof LANGUAGES)[number]["code"];
const STORAGE_KEY = "ceventic_language";
const dictionaries: Record<Exclude<Locale, "en">, Record<string, string>> = { ar, es, fr, zh };
const listeners = new Set<() => void>();
export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some((language) => language.code === value);
}
function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* The language switch also works when storage is unavailable. */ }
  return "en";
}
let locale: Locale = readLocale();
export function getLocale(): Locale { return locale; }
export function formatNumber(value: number): string { return new Intl.NumberFormat(getIntlLocale()).format(value); }
export function getIntlLocale(): string { return locale === "zh" ? "zh-CN" : locale; }
function updateDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = getIntlLocale();
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}
export function setLocale(next: Locale) {
  if (!isLocale(next)) return;
  locale = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-memory preference. */ }
  updateDocument();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** Subscribe at the start of each component that renders localized copy. */
export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale, () => "en" as Locale);
}
/** Only app-owned messages are passed here; user-authored data stays untouched. */
export function t(message: string, values: Record<string, string | number> = {}): string {
  const translated = locale === "en" ? message : dictionaries[locale][message] ?? message;
  return translated.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key];
    if (value === undefined) return token;
    return typeof value === "number" ? new Intl.NumberFormat(getIntlLocale()).format(value) : value;
  });
}
updateDocument();
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    locale = readLocale();
    updateDocument();
    listeners.forEach((listener) => listener());
  });
}
