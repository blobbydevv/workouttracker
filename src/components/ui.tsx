import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

export function Header({ title, back, right, center }: { title: string; back?: boolean | string; right?: ReactNode; center?: boolean }) {
  const nav = useNavigate();
  return (
    <header className="header">
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => (typeof back === "string" ? nav(back) : nav(-1))}>
          <Icon name="back" />
        </button>
      )}
      <h1 className={center ? "title-center" : undefined}>{title}</h1>
      {right}
      {center && back && !right && <span style={{ width: 40 }} />}
    </header>
  );
}

export function Sheet({ open, onClose, title, children, label }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; label?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const [startY, setStartY] = useState<number | null>(null);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        onTouchStart={(e) => setStartY(e.touches[0].clientY)}
        onTouchEnd={(e) => {
          // Swipe-down to dismiss.
          if (startY != null && e.changedTouches[0].clientY - startY > 90 && (e.currentTarget.scrollTop ?? 0) <= 0) onClose();
          setStartY(null);
        }}
      >
        <div className="grabber" aria-hidden />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </>
  );
}

export function Confirm({ open, title, body, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; body?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="muted">{body}</p>}
      <div className="list" style={{ gap: 8 }}>
        <button className={`btn block ${danger ? "danger" : ""}`} style={danger ? { border: "1px solid var(--danger)" } : undefined} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </button>
        <button className="btn block secondary" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return (
    <div className="empty" role="status" aria-live="polite">
      <span className="spinner" /> <div className="faint">Loading…</div>
    </div>
  );
}

export function Unverified({ children }: { children: ReactNode }) {
  return <div className="notice" data-parity="unverified">{children}</div>;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function NumberInput({ value, onChange, step = 1, min = 0, label, placeholder, inputMode = "decimal" }: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; label: string; placeholder?: string; inputMode?: "decimal" | "numeric" }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      aria-label={label}
      inputMode={inputMode}
      type="text"
      value={text}
      placeholder={placeholder}
      step={step}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(t);
      }}
      onBlur={() => {
        const n = text === "" ? null : Math.max(min, Number(text));
        onChange(n != null && Number.isFinite(n) ? n : null);
      }}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}

export const fmt = (n: number | null | undefined, d = 0) => (n == null || !Number.isFinite(n) ? "–" : n.toFixed(d).replace(/\.0+$/, ""));

/** Checkbox with optimistic local state, for settings persisted asynchronously. */
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [v, setV] = useState(checked);
  useEffect(() => {
    setV(checked);
  }, [checked]);
  return <input type="checkbox" checked={v} style={{ width: 22, height: 22 }} onChange={(e) => { setV(e.target.checked); onChange(e.target.checked); }} />;
}
