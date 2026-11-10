import React, { useEffect, useRef, useState } from "react";
import {
  planningSaveState,
  type SaveOperation,
} from "./lib/trainer-save-state";

export function PlanningSaveState({
  dirty,
  published = false,
  operation,
  failure,
  detail,
  retry,
  savedTitle,
}: {
  dirty: boolean;
  published?: boolean;
  operation?: SaveOperation | null;
  failure?: { operation: SaveOperation; message: string } | null;
  detail: string;
  retry: () => void;
  savedTitle?: string;
}) {
  const state = planningSaveState({ dirty, published, operation, failure });
  return (
    <div
      className="tp-save-state"
      data-save-state={state.phase}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="tp-state-dot" aria-hidden="true">
        {state.phase === "saving"
          ? "◌"
          : state.phase === "failed"
            ? "!"
            : state.phase === "unsaved" || state.phase === "unpublished"
              ? "●"
              : "✓"}
      </span>
      <div>
        <strong>
          {state.phase === "saved" && savedTitle ? savedTitle : state.title}
        </strong>
        <small>
          {failure
            ? failure.message + " Değişikliklerin bu ekranda korundu."
            : detail}
        </small>
      </div>
      {failure && !operation && (
        <button onClick={retry} className="tp-retry">
          Yeniden dene
        </button>
      )}
    </div>
  );
}

/** Desktop panels stay open; phones reveal secondary information on demand. */
export function PlanningSection({
  title,
  children,
  className = "",
  mobileOpen = false,
  desktopOpen = true,
  forceOpen,
  onOpenChange,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  mobileOpen?: boolean;
  desktopOpen?: boolean;
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const initialMobileOpen = useRef(mobileOpen);
  const [open, setOpen] = useState(() =>
    window.matchMedia("(min-width: 768px)").matches ? desktopOpen : mobileOpen,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const resize = () =>
      setOpen(query.matches ? desktopOpen : initialMobileOpen.current);
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  return (
    <details
      className={"tp-disclosure " + className}
      open={forceOpen ?? open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        onOpenChange?.(e.currentTarget.open);
      }}
    >
      <summary>{title}</summary>
      <div className="tp-disclosure-body">{children}</div>
    </details>
  );
}

/** Reserve the real action-bar height and follow the visible keyboard viewport. */
export function usePlanningViewport(hasActions: string | false) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node || !hasActions) return;
    const bar = node.querySelector<HTMLElement>(".tp-savebar");
    if (!bar) return;
    let frame = 0;
    const previousPadding = document.documentElement.style.scrollPaddingBottom;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mobile = window.matchMedia("(max-width: 767px)").matches;
        const height = bar.getBoundingClientRect().height;
        node.style.setProperty("--tp-action-height", height + "px");
        const workspace = node.querySelector<HTMLElement>(
          ".tp-workspace,.tp-planner-layout",
        );
        if (!mobile && workspace) {
          node.style.setProperty(
            "--tp-editor-height",
            Math.max(
              workspace.classList.contains("tp-planner-layout") ? 260 : 320,
              window.innerHeight -
                workspace.getBoundingClientRect().top -
                height -
                32,
            ) + "px",
          );
        }
        const viewport = window.visualViewport;
        const offset =
          mobile && viewport
            ? Math.max(
                0,
                window.innerHeight - viewport.height - viewport.offsetTop,
              )
            : 0;
        node.style.setProperty("--tp-keyboard-offset", offset + "px");
        document.documentElement.style.scrollPaddingBottom = mobile
          ? height + 20 + "px"
          : previousPadding;
        const input = document.activeElement;
        if (
          mobile &&
          input instanceof HTMLElement &&
          node.contains(input) &&
          !input.closest("dialog,.tp-exercise-library") &&
          input.matches("input,textarea,select")
        ) {
          const bounds = input.getBoundingClientRect(),
            barTop = bar.getBoundingClientRect().top;
          if (
            bounds.bottom > barTop - 16 ||
            bounds.top < (viewport?.offsetTop ?? 0) + 12
          )
            input.scrollIntoView({ block: "center" });
        }
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    observer.observe(node);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    node.addEventListener("focusin", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      node.removeEventListener("focusin", update);
      document.documentElement.style.scrollPaddingBottom = previousPadding;
    };
  }, [hasActions]);
  return root;
}

/** Keep transient keyboard text out of the persisted target shape; accept decimal commas. */
export function TargetNumberInput({
  value,
  onValue,
  min,
  max,
  optional = false,
  integer = false,
  ...props
}: {
  value: number | null | undefined;
  onValue: (value: number | null) => void;
  min: number;
  max: number;
  optional?: boolean;
  integer?: boolean;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max"
>) {
  const display = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "" : String(n);
  const [text, setText] = useState(() => display(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(display(value));
  }, [value]);
  const parsed = text.trim() === "" ? null : Number(text.replace(",", "."));
  const invalid =
    parsed == null
      ? !optional
      : !Number.isFinite(parsed) ||
        parsed < min ||
        parsed > max ||
        (integer && !Number.isInteger(parsed));
  return (
    <div className="tp-numeric">
      <input
        {...props}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && props.id ? props.id + "-error" : undefined}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onValue(
            raw.trim() === ""
              ? optional
                ? null
                : Number.NaN
              : Number(raw.replace(",", ".")),
          );
        }}
        onBlur={() => {
          editing.current = false;
          if (!invalid && parsed != null) setText(String(parsed));
        }}
      />
      {invalid && (
        <small
          id={props.id ? props.id + "-error" : undefined}
          className="tp-number-error"
        >
          {integer ? "Tam sayı" : "Sayı"} gir: {min}–{max}
          {optional ? " (veya boş bırak)" : ""}.
        </small>
      )}
    </div>
  );
}
