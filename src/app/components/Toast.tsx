import { useEffect, useSyncExternalStore } from 'react';

export interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let current: ToastMsg | null = null;
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

/** One toast at a time; a new one replaces the old. */
export function toast(text: string, action?: ToastMsg['action']): void {
  current = { id: ++seq, text, action };
  emit();
}

export function ToastHost() {
  const msg = useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => current,
    () => current,
  );
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => {
      if (current?.id === msg.id) {
        current = null;
        emit();
      }
    }, 6000);
    return () => window.clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{msg.text}</span>
      {msg.action ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            msg.action?.run();
            current = null;
            emit();
          }}
        >
          {msg.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss"
        style={{ color: 'inherit' }}
        onClick={() => {
          current = null;
          emit();
        }}
      >
        ×
      </button>
    </div>
  );
}
