import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../contexts/ThemeContext";
import {
  hexToHsv,
  hsvToHex,
  normalizeColorHex,
  wheelColor,
  type HSV,
} from "../lib/color";
import { t as tr, useLocale } from "../i18n";
import { Icon } from "./icons";

type Props = {
  initialHex: string;
  presets: { label: string; hex: string }[];
  onCancel: () => void;
  onSet: (hex: string) => void;
};
export function ColorWheelSheet({
  initialHex,
  presets,
  onCancel,
  onSet,
}: Props) {
  useLocale();
  const { previewAccent } = useTheme();
  const [hsv, setHsv] = useState(() => hexToHsv(initialHex));
  const [hexInput, setHexInput] = useState(initialHex.toUpperCase());
  const layer = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const pointer = useRef<number | null>(null);
  const title = useId(),
    help = useId(),
    hexHelp = useId();
  const hex = hsvToHex(hsv);
  const validHex = normalizeColorHex(hexInput);
  const update = (next: HSV) => {
    setHsv(next);
    const exact = hsvToHex(next);
    setHexInput(exact);
    previewAccent(exact);
  };
  const pickHex = (value: string) => {
    setHexInput(value.toUpperCase());
    const normalized = normalizeColorHex(value);
    if (!normalized) return;
    const next = hexToHsv(normalized);
    setHsv((current) => ({ ...next, h: next.s === 0 ? current.h : next.h }));
    previewAccent(normalized);
  };
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children)
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node !== layer.current,
      )
      .map((node) => ({ node, inert: node.inert }));
    siblings.forEach(({ node }) => {
      node.inert = true;
    });
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const resize = () => {
      if (!layer.current) return;
      const viewport = window.visualViewport;
      layer.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
      layer.current.style.top = `${viewport?.offsetTop ?? 0}px`;
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelRef.current();
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      document.body.style.overflow = previousOverflow;
      siblings.forEach(({ node, inert }) => {
        node.inert = inert;
      });
      previewAccent(null);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [previewAccent]);
  const wheelPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    update(
      wheelColor(
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
        rect.width / 2,
        hsv.v,
        hsv.h,
      ),
    );
  };
  return createPortal(
    <div
      ref={layer}
      data-no-swipe
      className="fixed inset-x-0 top-0 z-[22000] flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/70"
        aria-label={tr("Cancel color selection")}
        onClick={onCancel}
      />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-surface shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="shrink-0 px-4 pb-3 pt-2">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden"
          />
          <h2 id={title} className="text-base font-semibold text-white">
            {tr("Choose accent color")}
          </h2>
          <p className="mt-1 text-xs text-white/50">
            {tr(
              "Preview your color. Set to save, or Cancel to keep your current theme.",
            )}
          </p>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain border-y border-white/10 px-4 py-3">
          <p id={help} className="sr-only">
            {tr(
              "Drag around the wheel for hue and toward the center for less saturation. Arrow keys change hue.",
            )}
          </p>
          <div
            role="slider"
            tabIndex={0}
            aria-label={tr("Hue")}
            aria-describedby={help}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.floor(hsv.h)}
            aria-valuetext={tr("Hue {0} degrees, saturation {1}%", {
              0: Math.round(hsv.h),
              1: Math.round(hsv.s * 100),
            })}
            className="relative mx-auto touch-none select-none rounded-full border border-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{
              width: "min(64vw, 230px, 32dvh)",
              aspectRatio: "1",
              background:
                "radial-gradient(closest-side, white, transparent), conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)",
            }}
            onPointerDown={(event) => {
              if (
                pointer.current !== null ||
                (event.pointerType === "mouse" && event.button !== 0)
              )
                return;
              event.preventDefault();
              pointer.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              wheelPointer(event);
            }}
            onPointerMove={(event) => {
              if (pointer.current === event.pointerId) wheelPointer(event);
            }}
            onPointerUp={(event) => {
              if (pointer.current === event.pointerId) {
                wheelPointer(event);
                pointer.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
            onLostPointerCapture={() => {
              pointer.current = null;
            }}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 10 : 1;
              let h = hsv.h;
              if (["ArrowRight", "ArrowUp"].includes(event.key)) h += delta;
              else if (["ArrowLeft", "ArrowDown"].includes(event.key))
                h -= delta;
              else if (event.key === "Home") h = 0;
              else if (event.key === "End") h = 359;
              else return;
              event.preventDefault();
              update({ ...hsv, h: (h + 360) % 360 });
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full bg-black"
              style={{ opacity: 1 - hsv.v }}
            />
            <span
              className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgba(0,0,0,.65)]"
              style={{
                left: `${50 + Math.cos((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
                top: `${50 + Math.sin((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
                background: hex,
              }}
            />
          </div>
          <div className="mt-4 space-y-2">
            <label className="block text-xs text-white/65">
              <span className="flex justify-between gap-3">
                <span>{tr("Saturation")}</span>
                <span>{Math.round(hsv.s * 100)}%</span>
              </span>
              <input
                aria-label={tr("Saturation")}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(hsv.s * 100)}
                onChange={(event) =>
                  update({ ...hsv, s: Number(event.target.value) / 100 })
                }
                style={
                  {
                    "--sw-color-track": `linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 1 })})`,
                  } as CSSProperties
                }
                className="sw-range sw-color-range block w-full"
              />
            </label>
            <label className="block text-xs text-white/65">
              <span className="flex justify-between gap-3">
                <span>{tr("Brightness")}</span>
                <span>{Math.round(hsv.v * 100)}%</span>
              </span>
              <input
                aria-label={tr("Brightness")}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(hsv.v * 100)}
                onChange={(event) =>
                  update({ ...hsv, v: Number(event.target.value) / 100 })
                }
                style={
                  {
                    "--sw-color-track": `linear-gradient(to right, black, ${hsvToHex({ ...hsv, v: 1 })})`,
                  } as CSSProperties
                }
                className="sw-range sw-color-range block w-full"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-11 w-11 shrink-0 rounded-xl border border-white/20"
              style={{ background: hex }}
            />
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/15 bg-black/30 px-3 text-xs text-white/55">
              HEX
              <input
                aria-label={tr("HEX color")}
                aria-invalid={!validHex}
                aria-describedby={!validHex ? hexHelp : undefined}
                dir="ltr"
                value={hexInput}
                onChange={(event) => pickHex(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={7}
                className="min-h-11 w-full min-w-0 bg-transparent font-mono text-base uppercase text-white outline-none"
              />
            </label>
          </div>
          {!validHex && (
            <p id={hexHelp} className="mt-2 text-xs text-red-300">
              {tr("Enter 3 or 6 HEX digits, for example #ABCDEF.")}
            </p>
          )}
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label={tr("Color presets")}
          >
            {presets.map((preset) => (
              <button
                key={preset.label}
                aria-label={preset.label}
                aria-pressed={normalizeColorHex(preset.hex) === hex}
                onClick={() => pickHex(preset.hex)}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/[0.03] focus-visible:outline-white"
              >
                <span
                  className="h-7 w-7 rounded-full border border-white/15"
                  style={{ background: preset.hex }}
                />
              </button>
            ))}
          </div>
          <div
            aria-label={tr("Live preview")}
            className="mt-3 flex min-h-14 items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2"
          >
            <Icon
              name="checkCircle"
              className="h-5 w-5 shrink-0 text-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white/80">
                {tr("Live preview")}
              </p>
              <div className="mt-2 h-1.5 w-3/4 rounded-full bg-[image:var(--sw-gradient)]" />
            </div>
            <span className="rounded-lg border border-primary/30 px-2 py-1 text-xs text-primary">
              {tr("Focus")}
            </span>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            className="min-h-11 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/70"
            onClick={onCancel}
          >
            {tr("Cancel")}
          </button>
          <button
            disabled={!validHex}
            className="min-h-11 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-30"
            onClick={() => {
              if (validHex) onSet(validHex);
            }}
          >
            {tr("Set color")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
