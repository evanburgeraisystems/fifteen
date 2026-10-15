import { BUSINESS_CAREERS, CITIES, CLASS_YEARS, INDUSTRIES } from '../../core/taxonomy.ts';
import { HOURS_PER_YEAR } from '../../core/pay.ts';
import type { CityId, Targets } from '../../core/types.ts';

const ALL_CITIES: CityId[] = CITIES.map((c) => c.id);
/** Every in-person US option (the named metros plus "Other US"); everything except Remote. */
const US_CITIES: CityId[] = ALL_CITIES.filter((id) => id !== 'remote');

const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && b.every((x) => a.includes(x));

function toggle<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x];
}

export function targetsValid(t: Targets): boolean {
  return t.industries.length > 0 && t.careers.length > 0 && t.cities.length > 0;
}

/** Class year, industries, careers, cities (required) and an optional pay floor. */
export function TargetsEditor({ value, onChange }: { value: Targets; onChange: (update: (t: Targets) => Targets) => void }) {
  const unit = value.payFloorUnit ?? 'hour';
  // The floor is stored hourly; a salary floor shows as the yearly figure the student typed.
  const shown =
    value.payFloorHourly == null ? null : unit === 'year' ? Math.round(value.payFloorHourly * HOURS_PER_YEAR) : value.payFloorHourly;
  return (
    <div className="targets">
      <fieldset className="fieldset">
        <legend className="field-label">Class year</legend>
        <div className="seg" role="radiogroup" aria-label="Class year">
          {CLASS_YEARS.filter((c) => c.id !== 'senior').map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value.classYear === c.id}
              className="seg-btn"
              onClick={() => onChange((t) => ({ ...t, classYear: c.id }))}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <ChipSet
        legend="Industries"
        hint="Pick any. These filter what Home shows."
        options={INDUSTRIES}
        value={value.industries}
        onToggle={(id) => onChange((t) => ({ ...t, industries: toggle(t.industries, id) }))}
      />
      <ChipSet
        legend="Careers"
        options={BUSINESS_CAREERS}
        value={value.careers}
        onToggle={(id) => onChange((t) => ({ ...t, careers: toggle(t.careers, id) }))}
      />
      <ChipSet
        legend="Cities"
        options={CITIES}
        value={value.cities}
        onToggle={(id) => onChange((t) => ({ ...t, cities: toggle(t.cities, id) }))}
        shortcuts={[
          { label: 'All', ids: ALL_CITIES },
          { label: 'United States', ids: US_CITIES },
        ]}
        onSet={(ids) => onChange((t) => ({ ...t, cities: ids }))}
      />

      <div className="field pay-floor">
        <label className="field-label" htmlFor="pay-floor">
          Pay floor <span className="muted">(optional)</span>
        </label>
        <div className="seg" role="radiogroup" aria-label="Pay floor unit">
          {(['hour', 'year'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              className="seg-btn"
              onClick={() => onChange((t) => ({ ...t, payFloorUnit: u }))}
            >
              {u === 'hour' ? 'Hourly' : 'Salary'}
            </button>
          ))}
        </div>
        <div className="input-affix">
          <span aria-hidden="true">$</span>
          <input
            id="pay-floor"
            className="input"
            inputMode="numeric"
            placeholder={unit === 'year' ? 'e.g. 45,000' : 'e.g. 20'}
            value={shown == null ? '' : unit === 'year' ? shown.toLocaleString('en-US') : shown}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
              const v = e.target.value.trim() === '' || !Number.isFinite(n) ? null : n;
              onChange((t) => ({ ...t, payFloorHourly: v == null ? null : unit === 'year' ? v / HOURS_PER_YEAR : v }));
            }}
            aria-describedby="pay-floor-hint"
          />
          <span aria-hidden="true">{unit === 'year' ? '/yr' : '/hr'}</span>
        </div>
        <span id="pay-floor-hint" className="field-hint">
          Roles that list lower pay rank lower. Roles without pay listed are kept.
        </span>
      </div>
    </div>
  );
}

function ChipSet<T extends string>({
  legend,
  hint,
  options,
  value,
  onToggle,
  shortcuts = [],
  onSet,
}: {
  legend: string;
  hint?: string;
  options: { id: T; label: string }[];
  value: T[];
  onToggle: (id: T) => void;
  /** Chips that select a whole group at once; pressed when the selection is exactly that group. */
  shortcuts?: { label: string; ids: T[] }[];
  onSet?: (ids: T[]) => void;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="field-label">
        {legend} {value.length === 0 ? <span className="req">· pick at least one</span> : null}
      </legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="chip-row">
        {shortcuts.map((s) => {
          const on = sameSet(value, s.ids);
          return (
            <button key={s.label} type="button" className="chip" aria-pressed={on} onClick={() => onSet?.(on ? [] : s.ids)}>
              {s.label}
            </button>
          );
        })}
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={value.includes(o.id)} onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
