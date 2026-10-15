import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

export interface Option<T extends string> {
  id: T;
  label: string;
}

/** A compact multi-select: "Industry  Finance, Consulting ▾" with a checkbox popover. */
export function FilterMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>('.filter-btn')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const picked = options.filter((o) => value.includes(o.id));
  const summary =
    picked.length === 0
      ? allLabel
      : picked.length <= 2
        ? picked.map((o) => o.label).join(', ')
        : `${picked[0]?.label ?? ''} +${picked.length - 1}`;

  const toggle = (id: T) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="filter" ref={ref}>
      <button
        type="button"
        className="filter-btn"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`${label}: ${summary}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="k">{label}</span>
        <span className="v">{summary}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div className="filter-pop" id={popId} role="group" aria-label={label}>
          <div className="filter-pop-head">
            <span>{picked.length ? `${picked.length} selected` : allLabel}</span>
            <button type="button" className="link-btn" onClick={() => onChange([])} disabled={picked.length === 0}>
              Clear
            </button>
          </div>
          {options.map((o) => (
            <label key={o.id} className="check-row">
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
