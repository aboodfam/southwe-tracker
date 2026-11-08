import { expect, test } from "vitest";
import { hexToHsv, hsvToHex, normalizeColorHex, wheelColor } from "../src/lib/color";
test("HEX edits normalize safely and preserve exact arbitrary accent colors", () => {
  expect(normalizeColorHex(" abc ")).toBe("#AABBCC");
  expect(normalizeColorHex("#a12F09")).toBe("#A12F09");
  for (const input of ["", "#", "12345", "#zzffff", "#abcdef00", "var(--accent)"]) expect(normalizeColorHex(input)).toBeNull();
  for (const hex of ["#000000", "#FFFFFF", "#A3A3A3", "#22D3EE", "#F43F5E", "#A855F7", "#10B981", "#123456", "#FE0102"]) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
});
test("wheel geometry and sliders retain hue, neutrals and black without invalid values", () => {
  expect(wheelColor(100, 0, 100, 1)).toEqual({h: 0, s: 1, v: 1});
  expect(wheelColor(0, 100, 100, 0.7)).toEqual({h: 90, s: 1, v: 0.7});
  expect(wheelColor(0, 0, 100, 1, 220)).toEqual({h: 220, s: 0, v: 1});
  expect(wheelColor(-1000, 0, 100, 1).s).toBe(1);
  expect(hsvToHex({h: 120, s: 1, v: 1})).toBe("#00FF00");
  expect(hsvToHex({h: 240, s: 0, v: 1})).toBe("#FFFFFF");
  expect(hsvToHex({h: 240, s: 1, v: 0})).toBe("#000000");
});
