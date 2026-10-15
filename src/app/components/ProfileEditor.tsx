import { useId, useState } from 'react';
import { SIGNALS, signalLabel } from '../../core/signals.ts';
import type { Profile } from '../../core/types.ts';
import { Icon } from './Icon.tsx';

const SKILL_OPTIONS = SIGNALS.filter((s) => s.kind !== 'trait' && s.kind !== 'major');
const MAJOR_OPTIONS = SIGNALS.filter((s) => s.kind === 'major');

/** "Confirm what we read": every field the fit model uses, as editable chips and inputs. */
export function ProfileEditor({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <div className="profile-edit">
      <div className="profile-grid">
        <div className="field">
          <label className="field-label" htmlFor="pf-school">
            School
          </label>
          <input id="pf-school" className="input" value={value.school ?? ''} onChange={(e) => onChange({ ...value, school: e.target.value || null })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pf-grad">
            Graduation year
          </label>
          <input
            id="pf-grad"
            className="input"
            inputMode="numeric"
            value={value.gradYear ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...value, gradYear: e.target.value && Number.isInteger(n) ? n : null });
            }}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pf-gpa">
            GPA <span className="muted">(optional)</span>
          </label>
          <input
            id="pf-gpa"
            className="input"
            inputMode="decimal"
            value={value.gpa ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...value, gpa: e.target.value && n > 0 && n <= 4.3 ? n : null });
            }}
          />
        </div>
      </div>
      <SignalChips
        legend="Majors"
        ids={value.majors}
        options={MAJOR_OPTIONS}
        onChange={(majors) => onChange({ ...value, majors })}
        addLabel="Add a major"
      />
      <SignalChips
        legend="Skills and experience we found"
        ids={value.skills}
        options={SKILL_OPTIONS}
        onChange={(skills) => onChange({ ...value, skills })}
        addLabel="Add a skill"
      />
    </div>
  );
}

function SignalChips({
  legend,
  ids,
  options,
  onChange,
  addLabel,
}: {
  legend: string;
  ids: string[];
  options: { id: string; label: string }[];
  onChange: (ids: string[]) => void;
  addLabel: string;
}) {
  const [adding, setAdding] = useState('');
  const selectId = useId();
  const remaining = options.filter((o) => !ids.includes(o.id));
  return (
    <fieldset className="fieldset">
      <legend className="field-label">{legend}</legend>
      <div className="chip-row">
        {ids.length === 0 ? <span className="field-hint">None yet.</span> : null}
        {ids.map((id) => (
          <span key={id} className="chip chip-static" data-testid={`signal-${id}`}>
            {signalLabel(id)}
            <button type="button" className="chip-x" aria-label={`Remove ${signalLabel(id)}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        <label className="sr-only" htmlFor={selectId}>
          {addLabel}
        </label>
        <select
          id={selectId}
          className="chip chip-add"
          value={adding}
          onChange={(e) => {
            if (e.target.value) onChange([...ids, e.target.value]);
            setAdding('');
          }}
        >
          <option value="">+ {addLabel}</option>
          {remaining.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
