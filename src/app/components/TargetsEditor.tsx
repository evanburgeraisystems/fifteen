import { BUSINESS_CAREERS, CITIES, CLASS_YEARS, INDUSTRIES } from '../../core/taxonomy.ts';
import type { Targets } from '../../core/types.ts';

function toggle<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x];
}

export function targetsValid(t: Targets): boolean {
  return t.industries.length > 0 && t.careers.length > 0 && t.cities.length > 0;
}

/** Class year, industries, careers, cities (required) and an optional pay floor. */
export function TargetsEditor({ value, onChange }: { value: Targets; onChange: (update: (t: Targets) => Targets) => void }) {
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
      />

      <div className="field pay-floor">
        <label className="field-label" htmlFor="pay-floor">
          Pay floor <span className="muted">(optional)</span>
        </label>
        <div className="input-affix">
          <span aria-hidden="true">$</span>
          <input
            id="pay-floor"
            className="input"
            inputMode="numeric"
            placeholder="20"
            value={value.payFloorHourly ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
              const v = e.target.value.trim() === '' || !Number.isFinite(n) ? null : n;
              onChange((t) => ({ ...t, payFloorHourly: v }));
            }}
            aria-describedby="pay-floor-hint"
          />
          <span aria-hidden="true">/hr</span>
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
}: {
  legend: string;
  hint?: string;
  options: { id: T; label: string }[];
  value: T[];
  onToggle: (id: T) => void;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="field-label">
        {legend} {value.length === 0 ? <span className="req">· pick at least one</span> : null}
      </legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <div className="chip-row">
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={value.includes(o.id)} onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
