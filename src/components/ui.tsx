"use client";

import { useEffect, useRef, useState } from "react";

/** A calm, satisfaction-as-color scale from 1–10. */
export function SatisfactionScale({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            aria-label={`Set satisfaction to ${n}`}
            className={`h-2.5 rounded-full transition-all ${
              active ? "w-3.5" : "w-2.5"
            } ${readOnly ? "" : "cursor-pointer hover:opacity-80"}`}
            style={{
              backgroundColor: active ? satisfactionColor(value) : "var(--line-strong)",
            }}
          />
        );
      })}
      <span className="ml-2 text-xs tabular-nums text-ink-faint">{value}/10</span>
    </div>
  );
}

/** Green when thriving, clay when an area needs attention. */
export function satisfactionColor(v: number): string {
  if (v >= 7) return "var(--sage)";
  if (v >= 4) return "var(--clay)";
  return "#c2705f";
}

/** Click-to-edit text that commits on blur / Enter. */
export function InlineEdit({
  value,
  onCommit,
  className = "",
  placeholder,
  multiline,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Re-sync the draft when the committed value changes (render-phase pattern,
  // per react.dev "you might not need an effect").
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={`cursor-text rounded px-0.5 hover:bg-sage-tint/60 ${className}`}
      >
        {value || <span className="text-ink-faint">{placeholder}</span>}
      </span>
    );
  }

  const shared = {
    ref,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    className: `w-full rounded border border-sage/40 bg-paper-raised px-1.5 py-0.5 outline-none focus:border-sage ${className}`,
  };

  return multiline ? (
    <textarea
      {...shared}
      rows={3}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  ) : (
    <input
      {...shared}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-sage text-white hover:bg-sage-deep shadow-sm",
    soft: "bg-sage-tint text-sage-deep hover:bg-sage-tint/70",
    ghost: "text-ink-soft hover:bg-line/60 hover:text-ink",
    danger: "text-[#b15a4a] hover:bg-clay-tint",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
