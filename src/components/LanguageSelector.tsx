import { LANGUAGES, setLocale, t, useLocale } from "../i18n";
import { ChoiceSelect } from "./ChoiceSelect";

export function LanguageSelector({ settings = false }: { settings?: boolean }) {
  const locale = useLocale();
  return <ChoiceSelect label={t("Language")} value={locale} onChange={setLocale}
    className={settings ? "w-36 shrink-0" : "w-36"}
    options={LANGUAGES.map(language => ({value: language.code, label: language.name, lang: language.code, dir: language.direction}))} />;
}
