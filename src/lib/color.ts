export type HSV = { h: number; s: number; v: number };
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function normalizeColorHex(input: string): string | null {
  let raw = input.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(raw))
    raw = raw
      .split("")
      .map((char) => char + char)
      .join("");
  return /^[\da-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : null;
}
export function hexToHsv(hex: string): HSV {
  const normalized = normalizeColorHex(hex);
  if (!normalized) throw new Error("Invalid color");
  const [r, g, b] = [1, 3, 5].map(
    (index) => parseInt(normalized.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const h =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta + 6) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}
export function hsvToHex({ h, s, v }: HSV): string {
  const hue = ((h % 360) + 360) % 360,
    sat = clamp(s, 0, 1),
    value = clamp(v, 0, 1);
  const c = value * sat,
    x = c * (1 - Math.abs(((hue / 60) % 2) - 1)),
    m = value - c;
  const rgb =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}
/** Wheel origin is red on the right, increasing hue clockwise, saturation radially. */
export function wheelColor(
  x: number,
  y: number,
  radius: number,
  v: number,
  previousHue = 0,
): HSV {
  const distance = Math.hypot(x, y);
  return {
    h:
      distance < 0.5
        ? previousHue
        : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    s: clamp(distance / Math.max(1, radius), 0, 1),
    v,
  };
}
