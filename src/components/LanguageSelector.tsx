import { LANGUAGES, setLocale, t, useLocale, type Locale } from "../i18n";

export function LanguageSelector() {
  const locale = useLocale();
  return (
    <label className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-2.5 text-sm text-white/80 focus-within:ring-2 focus-within:ring-white/40">
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="min-h-11 w-[4.75rem] cursor-pointer bg-transparent text-sm outline-none sm:w-24"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} lang={language.code} dir={language.direction} className="bg-neutral-950 text-white">
            {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}
