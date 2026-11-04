import { getLocale, t } from "./index";
// Domain-specific labels prevent the navigation action "Back" from being used
// as the name of the back muscles. Stored category values remain unchanged.
const labels: Record<string, string> = {
  chest: "Chest", back: "Back muscles", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", legs: "Legs", glutes: "Glutes", abs: "Abs", calves: "Calves",
  "forearms/grip": "Forearms/Grip", cardio: "Cardio", "full body": "Full Body",
  mobility: "Mobility", other: "Other", arms: "Arms",
  "chest & back": "Chest & Back", "shoulders & arms": "Shoulders & Arms",
};
const keyFor = (value: string) => labels[value.trim().toLowerCase().replace(/\s*\/\s*/g, "/")];
const translate = (key: string) => key === "Back muscles" && getLocale() === "en" ? "Back" : t(key);
export function muscleLabel(value: string): string {
  const key = keyFor(value);
  if (key) return translate(key);
  const parts = value.split(/\s*[,/+&]\s*/);
  if (parts.length > 1 && parts.every(part => keyFor(part))) {
    return parts.map(part => translate(keyFor(part))).join(getLocale() === "ar" ? "، " : ", ");
  }
  return value;
}
