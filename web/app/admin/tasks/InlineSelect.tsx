"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/** Same shape as the data layer's `TaskOption`, so pickers can pass it straight through. */
export type SelectOption = { id: string; label: string; sub?: string | null };

const ROW_PX = 34;

/**
 * A compact, fully custom picker for use inside a table row.
 *
 * The native `<select>` popup is drawn by the OS in a layer the page cannot
 * style: on a dark theme its focus highlight is a light-blue slab that ignores
 * every author rule, including `!important`. It is also clipped by the table's
 * `overflow-x-auto` wrapper. Rendering the list ourselves fixes both.
 *
 * Keyboard behaviour follows the listbox pattern — arrows, Home/End, Enter,
 * Escape, and type-ahead — so it is not a mouse-only control.
 */
export function InlineSelect({
  value,
  options,
  onChange,
  label,
  emptyLabel = "Unassigned",
  disabled,
  error,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name for the trigger, e.g. `Assign "Build tokens" to`. */
  label: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Non-null paints the trigger as failed and announces the message. */
  error?: string | null;
}) {
  const uid = useId();
  const listId = `${uid}-list`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeAhead = useRef({ buffer: "", at: 0 });

  // "Unassigned" leads the list so clearing an owner is one keystroke away,
  // and so it matches the order people already know from the old select.
  const all: SelectOption[] = [{ id: "", label: emptyLabel }, ...options];
  const selectedIndex = Math.max(
    0,
    all.findIndex((o) => o.id === value),
  );
  const selected = all[selectedIndex];

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const choice = all[index];
      if (!choice || choice.id === value) return;
      onChange(choice.id);
    },
    [all, onChange, value],
  );

  // Anchor to the trigger, flipping above it when there is not enough room
  // below. Repositions on scroll and resize because the row moves under both.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const flip = below < 160 && above > below;
      const room = Math.max(120, flip ? above : below);
      setBox({
        top: flip ? Math.max(8, r.top - 4 - room) : r.bottom + 4,
        left: r.left,
        width: Math.max(r.width, 176),
        maxHeight: Math.min(all.length * ROW_PX + 8, room),
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, all.length]);

  useEffect(() => {
    if (open) setActive(selectedIndex);
  }, [open, selectedIndex]);

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // A pointerdown anywhere else closes, so the menu never outlives the row.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  /**
   * All key handling lives on the trigger.
   *
   * The listbox never takes focus — nothing inside it is tabbable — so a
   * handler bound to the panel would never fire. Focus staying on the trigger
   * with `aria-activedescendant` is also what keeps the screen reader pointing
   * at the right option.
   */
  function onTriggerKeyDown(e: ReactKeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, all.length - 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(all.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        close();
        return;
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }

    // Type-ahead: typing "leo" jumps to Leo Fontaine without touching arrows.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const state = typeAhead.current;
      state.buffer = now - state.at > 800 ? e.key : state.buffer + e.key;
      state.at = now;
      const needle = state.buffer.toLowerCase();
      const hit = all.findIndex(
        (o) => o.id !== "" && o.label.toLowerCase().startsWith(needle),
      );
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={error ?? label}
        data-empty={value === ""}
        className="rv-inline-select"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className="rv-inline-caret"
          data-open={open}
          aria-hidden="true"
        />
      </button>

      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}

      {open && box
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              style={{
                top: box.top,
                left: box.left,
                minWidth: box.width,
                maxHeight: box.maxHeight,
              }}
              className="rv-inline-menu rv-animate-dropdown"
              data-lenis-prevent
              data-lenis-prevent-touch
              data-lenis-prevent-wheel
            >
              {all.map((option, index) => {
                const isSelected = option.id === value;
                return (
                  <div
                    key={option.id || "__empty"}
                    id={`${uid}-opt-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      commit(index);
                      close();
                    }}
                    className="rv-inline-option"
                    data-selected={isSelected}
                    data-active={index === active}
                  >
                    <Check
                      className="size-3.5 shrink-0 text-rhymvex-volt"
                      aria-hidden="true"
                      style={{ visibility: isSelected ? "visible" : "hidden" }}
                    />
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.sub ? (
                      <span className="ml-auto truncate pl-3 text-[11px] text-rhymvex-white/40">
                        {option.sub}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
