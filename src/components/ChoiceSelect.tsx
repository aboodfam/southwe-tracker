import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export type Choice<V extends string = string> = { value: V; label: string; lang?: string; dir?: "ltr" | "rtl" };
/** A themed picker shared by settings. Pointer users get no lingering focus box;
 * keyboard users keep a visible focus indicator and arrow-key selection. */
export function ChoiceSelect<V extends string>({ label, value, options, onChange, disabled = false, placeholder, className = "" }: {
  label: string;
  value: V;
  options: readonly Choice<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 240 });
  const search = useRef({ text: "", at: 0 });
  const selected = options.find(option => option.value === value);
  const reposition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const offset = viewport?.offsetTop ?? 0;
    const below = height + offset - rect.bottom - 16;
    const above = rect.top - offset - 16;
    const contentHeight = menu.current?.scrollHeight ?? options.length * 44 + 8;
    const upward = below < Math.min(240, contentHeight) && above > below;
    const maxHeight = Math.max(44, Math.min(240, upward ? above : below));
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 24);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upward ? rect.top - Math.min(maxHeight, contentHeight) - 6 : rect.bottom + 6, width, maxHeight });
  }, [options.length]);
  const close = (keyboard = false) => {
    setOpen(false);
    if (keyboard) trigger.current?.focus({ preventScroll: true });
    else if (document.activeElement === trigger.current || document.activeElement === menu.current) (document.activeElement as HTMLElement).blur();
  };
  const choose = (index: number, keyboard = false) => {
    const option = options[index];
    if (!option) return;
    close(keyboard);
    if (option.value !== value) onChange(option.value);
  };
  const show = () => {
    if (disabled || !options.length) return;
    setActive(Math.max(0, options.findIndex(option => option.value === value)));
    reposition();
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    reposition();
    menu.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!trigger.current?.contains(node) && !menu.current?.contains(node)) setOpen(false);
    };
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) reposition(); };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", scroll, true);
    window.visualViewport?.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", scroll, true);
      window.visualViewport?.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);
  useEffect(() => { if (open) menu.current?.querySelector<HTMLElement>(`[data-choice-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      className={`sw-choice-trigger inline-flex max-w-full min-h-11 min-w-0 items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-start text-sm text-white/85 transition hover:border-white/30 disabled:opacity-40 ${className}`}
      onClick={() => open ? close() : show()}
      onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); show(); } }}>
      <span className="min-w-0 truncate" lang={selected?.lang} dir={selected?.dir}>{selected?.label ?? placeholder ?? label}</span>
      <Icon name="chevronDown" className={`h-3.5 w-3.5 shrink-0 text-white/45 transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div ref={menu} id={id} role="listbox" aria-label={label} aria-activedescendant={`${id}-${active}`} tabIndex={-1}
        className="sw-choice-list fixed z-[20000] scrollbar-hide overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-[#101217] p-1 shadow-[0_16px_50px_rgba(0,0,0,.65)] outline-none" style={position}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
          else if (event.key === "Tab") close(true);
          else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active, true); }
          else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setActive(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key.length === 1) {
            const now = Date.now();
            const text = (now - search.current.at < 700 ? search.current.text : "") + event.key.toLocaleLowerCase();
            search.current = { text, at: now };
            const index = options.findIndex(option => option.label.toLocaleLowerCase().startsWith(text));
            if (index >= 0) setActive(index);
          }
        }}>
        {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value} data-choice-index={index}
          className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}
          onPointerMove={event => { if (event.pointerType === "mouse") setActive(index); }} onClick={() => choose(index)}>
          <span className="min-w-0 break-words" lang={option.lang} dir={option.dir}>{option.label}</span>
          {value === option.value && <Icon name="check" className="h-4 w-4 shrink-0 text-[rgb(var(--sw-accent-rgb))]" />}
        </div>)}
      </div>, document.body,
    )}
  </>;
}
