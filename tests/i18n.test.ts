import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import ar from "../src/i18n/ar.json";
import es from "../src/i18n/es.json";
import fr from "../src/i18n/fr.json";
import zh from "../src/i18n/zh.json";
import { getLocale, isLocale, setLocale, t } from "../src/i18n";
import { localizedComparison } from "../src/i18n/results";

const catalogs = { ar, es, fr, zh };
afterEach(() => { setLocale("en"); vi.unstubAllGlobals(); });

describe("localized interface", () => {
  it("provides every explicit UI message in all four added languages", () => {
    const keys = new Set<string>();
    for (const file of readdirSync(resolve("src"), { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file) || file.startsWith("i18n/")) continue;
      const source = ts.createSourceFile(file, readFileSync(resolve("src", file), "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ["tr", "t"].includes(node.expression.getText(source))) {
          const message = node.arguments[0];
          if (message && ts.isStringLiteral(message)) keys.add(message.text);
          if (message && ts.isConditionalExpression(message)) {
            for (const branch of [message.whenTrue, message.whenFalse]) if (ts.isStringLiteral(branch)) keys.add(branch.text);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(keys.size).toBeGreaterThan(700);
    for (const [locale, catalog] of Object.entries(catalogs)) {
      const missing = [...keys].filter(key => !Object.hasOwn(catalog, key));
      expect(missing, `${locale} missing translations`).toEqual([]);
    }
  });

  it("keeps matching interpolation placeholders in every translation", () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(ar).sort());
      for (const [key, value] of Object.entries(catalog)) {
        const tokens = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
        expect(value.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
        expect(tokens(value), `${locale}: ${key}`).toEqual(tokens(key));
      }
    }
  });

  it("switches languages, preserves user values and has an English fallback", () => {
    setLocale("ar");
    expect(getLocale()).toBe("ar");
    expect(t("Today")).toBe("اليوم");
    expect(t("Welcome, {0}", {0: "My <name>"})).toBe("أهلًا، My <name>");
    expect(t("My unique task")).toBe("My unique task");
    setLocale("fr");
    expect(t("Today")).toBe("Aujourd’hui");
    setLocale("zh");
    expect(t("Today")).toBe("今天");
    setLocale("es");
    expect(t("Today")).toBe("Hoy");
    setLocale("en");
    expect(t("Today")).toBe("Today");
    expect(isLocale("xx")).toBe(false);
    setLocale("xx" as "en");
    expect(getLocale()).toBe("en");
  });

  it("persists Arabic while preserving the same layout direction in every language", () => {
    const data = new Map<string, string>();
    const documentElement = { lang: "en", dir: "ltr" };
    vi.stubGlobal("localStorage", { setItem: (key: string, value: string) => data.set(key, value), getItem: (key: string) => data.get(key) ?? null });
    vi.stubGlobal("document", { documentElement });
    setLocale("ar");
    expect(data.get("ceventic_language")).toBe("ar");
    expect(documentElement).toEqual({lang: "ar", dir: "ltr"});
    setLocale("zh");
    expect(documentElement).toEqual({lang: "zh-CN", dir: "ltr"});
  });

  it("still changes language if browser storage is blocked", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Blocked"); } });
    expect(() => setLocale("ar")).not.toThrow();
    expect(t("Today")).toBe("اليوم");
  });

  it("localizes comparisons without changing which sets are comparable", () => {
    setLocale("fr");
    expect(localizedComparison({ exerciseId: "a", name: "Custom name", reps: 8 }, { exerciseId: "a", name: "Custom name", reps: 7 })).toBe("+1 répétitions à la même charge");
    expect(localizedComparison({ exerciseId: "a", name: "Custom name", holdSeconds: 8 }, { exerciseId: "a", name: "Custom name", holdSeconds: 10 })).toBe("-2 s par rapport à la dernière fois");
    expect(localizedComparison({ exerciseId: "a", name: "Custom name", reps: 8, weightKg: 10 }, { exerciseId: "a", name: "Custom name", reps: 8, weightKg: 9 })).toBe("+1 kg aux mêmes répétitions");
    expect(localizedComparison({ exerciseId: "a", name: "A", reps: 8 }, { exerciseId: "b", name: "B", reps: 7 })).toBeNull();
  });
});

it("also covers labels imported from the shared starter plans and progress filters", async () => {
  const { READY_TEMPLATES } = await import("../convex/supportModel");
  const { PAGES, STARTERS } = await import("../convex/planFormat");
  const messages = ["Routines", "Workouts", "Habits", "7 days", "28 days", "6 months", "Tasks done", "Habit check-ins", "Workouts saved", "Appearance", "Sounds", "Account"];
  for (const page of PAGES) messages.push(page.name);
  for (const template of READY_TEMPLATES) {
    messages.push(template.name, template.description, template.timeSlot);
    for (const task of template.tasks) {
      messages.push(task.name);
      if (task.fallbackName) messages.push(task.fallbackName);
    }
  }
  for (const starter of Object.values(STARTERS)) {
    messages.push(starter.name, starter.description);
    for (const routine of starter.plan.routines) messages.push(routine.name, routine.timeSlot, ...routine.tasks);
  }
  for (const [locale, catalog] of Object.entries(catalogs)) {
    expect(messages.filter(message => !Object.hasOwn(catalog, message)), locale).toEqual([]);
  }
});
