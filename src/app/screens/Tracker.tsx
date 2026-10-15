import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { INDUSTRIES, labelIndustry } from '../../core/taxonomy.ts';
import type { IndustryId, TrackerCard, TrackerStage } from '../../core/types.ts';
import { Icon } from '../components/Icon.tsx';
import { toast } from '../components/Toast.tsx';
import { fmtDate } from '../format.ts';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';

export const STAGES: { id: TrackerStage; label: string }[] = [
  { id: 'applied', label: 'Applied' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'denied', label: 'Denied' },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<TrackerStage, string>;

export function Tracker() {
  const { ds, state } = useApp();
  const [industries, setIndustries] = useState<IndustryId[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const cards = useMemo(
    () =>
      Object.values(state.tracker)
        .filter((c) => industries.length === 0 || industries.includes(c.industry))
        .sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1)),
    [state.tracker, industries],
  );

  const opened = useMemo(
    () =>
      Object.entries(state.statuses)
        .filter(([id, v]) => v.status === 'opened' && !state.tracker[id])
        .map(([id, v]) => ({ posting: ds.byId.get(id), at: v.at }))
        .filter((x): x is { posting: NonNullable<typeof x.posting>; at: string } => !!x.posting)
        .filter((x) => industries.length === 0 || industries.includes(x.posting.classification.industry))
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    [state.statuses, state.tracker, ds, industries],
  );

  const usedIndustries = useMemo(() => {
    const set = new Set<IndustryId>();
    for (const c of Object.values(state.tracker)) set.add(c.industry);
    for (const [id, v] of Object.entries(state.statuses)) {
      const p = ds.byId.get(id);
      if (p && v.status === 'opened') set.add(p.classification.industry);
    }
    return INDUSTRIES.filter((i) => set.has(i.id));
  }, [state.tracker, state.statuses, ds]);

  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id as TrackerStage | undefined;
    const id = String(e.active.id);
    const card = state.tracker[id];
    if (!to || !card || card.stage === to) return;
    move(card, to);
  };

  const move = (card: TrackerCard, to: TrackerStage) => {
    const from = card.stage;
    actions.moveCard(card.postingId, to, ds.nowIso());
    toast(`Moved to ${STAGE_LABEL[to]}`, { label: 'Undo', run: () => actions.moveCard(card.postingId, from, ds.nowIso()) });
  };

  const empty = cards.length === 0 && opened.length === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div className="head-row">
          <div>
            <h1 className="page-title">Tracker</h1>
            <p className="page-sub">Drag cards when a portal never emails. Denied roles never come back to your lists.</p>
          </div>
          <Link to="/season" className="btn btn-secondary btn-sm">
            Wrap up the season
          </Link>
        </div>
        {usedIndustries.length > 1 ? (
          <div className="chip-row tracker-chips" role="group" aria-label="Filter by industry">
            {usedIndustries.map((i) => (
              <button
                key={i.id}
                type="button"
                className="chip"
                aria-pressed={industries.includes(i.id)}
                onClick={() => setIndustries((xs) => (xs.includes(i.id) ? xs.filter((x) => x !== i.id) : [...xs, i.id]))}
              >
                {i.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {empty ? (
        <div className="state">
          <span className="state-icon">
            <Icon name="board" />
          </span>
          <h2>Nothing tracked yet</h2>
          <p>Open a role from Home. When you come back, tap “Yes” to confirm you applied and it lands here.</p>
          <Link to="/" className="btn btn-primary">
            Go to Home
          </Link>
        </div>
      ) : null}

      {opened.length ? (
        <section className="tray" aria-labelledby="tray-h" data-testid="opened-tray">
          <h2 id="tray-h" className="section-title">
            Opened <span className="muted">· confirm the ones you applied to</span>
          </h2>
          <ul className="tray-list">
            {opened.map(({ posting: p, at }) => (
              <li key={p.id} className="tray-item">
                <div className="tray-text">
                  <span className="job-company">{p.company}</span>
                  <span className="tray-title">{p.title}</span>
                  <span className="field-hint">Opened {fmtDate(at)}</span>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn-md tray-yes"
                  aria-label={`Confirm applied: ${p.title} at ${p.company}`}
                  title="I applied"
                  onClick={() => actions.markApplied(p, ds.nowIso())}
                >
                  <Icon name="check" size={18} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${p.title} from Opened`}
                  title="Didn’t apply"
                  onClick={() => actions.dismissOpened(p.id)}
                >
                  <Icon name="x" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cards.length ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="board">
            {STAGES.map((s) => (
              <Column key={s.id} stage={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id)} onMove={move} />
            ))}
          </div>
        </DndContext>
      ) : null}
    </div>
  );
}

function Column({ stage, label, cards, onMove }: { stage: TrackerStage; label: string; cards: TrackerCard[]; onMove: (c: TrackerCard, to: TrackerStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} className={`col col-${stage} ${isOver ? 'is-over' : ''}`} aria-labelledby={`col-${stage}`} data-testid={`col-${stage}`}>
      <div className="col-head">
        <h2 id={`col-${stage}`} className="lane-name">
          {label}
        </h2>
        <span className="num lane-count">{cards.length}</span>
      </div>
      <ul className="col-list">
        {cards.map((c) => (
          <li key={c.postingId}>
            <TrackCard card={c} onMove={onMove} />
          </li>
        ))}
      </ul>
      {cards.length === 0 ? <p className="col-empty">Drop here</p> : null}
    </section>
  );
}

function TrackCard({ card, onMove }: { card: TrackerCard; onMove: (c: TrackerCard, to: TrackerStage) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.postingId });
  const [notesOpen, setNotesOpen] = useState(card.notes.length > 0);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const email = card.movedByEmail;
  return (
    <article ref={setNodeRef} style={style} className={`tcard ${isDragging ? 'is-dragging' : ''}`} data-testid={`card-${card.postingId}`} aria-label={`${card.title} at ${card.company}, ${STAGE_LABEL[card.stage]}`}>
      <div className="tcard-top">
        <button type="button" className="icon-btn grip" aria-label={`Drag ${card.title}. Press space, then arrow keys to move.`} {...attributes} {...listeners}>
          <Icon name="grip" size={16} />
        </button>
        <span className="job-company">{card.company}</span>
      </div>
      <a className="tcard-title" href={card.applyUrl} target="_blank" rel="noopener noreferrer">
        {card.title}
      </a>
      <div className="job-meta">
        <span>Applied {fmtDate(card.appliedAt)}</span>
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <span>{labelIndustry(card.industry)}</span>
      </div>
      {email ? (
        <div className="email-tag" data-testid="moved-by-email">
          <Icon name="mail" size={13} /> Moved by email
          <button type="button" className="link-btn" onClick={() => actions.undoEmail(email.emailId)} aria-label={`Undo email move for ${card.title}`}>
            Undo
          </button>
        </div>
      ) : null}
      <div className="tcard-actions">
        <label className="sr-only" htmlFor={`mv-${card.postingId}`}>
          Move {card.title} to
        </label>
        <select
          id={`mv-${card.postingId}`}
          className="mini-select"
          value={card.stage}
          onChange={(e) => onMove(card, e.target.value as TrackerStage)}
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" className="link-btn" aria-expanded={notesOpen} onClick={() => setNotesOpen((o) => !o)}>
          {card.notes ? 'Notes' : 'Add note'}
        </button>
      </div>
      {notesOpen ? (
        <>
          <label className="sr-only" htmlFor={`nt-${card.postingId}`}>
            Notes for {card.title}
          </label>
          <textarea
            id={`nt-${card.postingId}`}
            className="input tcard-notes"
            value={card.notes}
            placeholder="Recruiter name, next step, anything"
            onChange={(e) => actions.setNotes(card.postingId, e.target.value)}
          />
        </>
      ) : null}
    </article>
  );
}
