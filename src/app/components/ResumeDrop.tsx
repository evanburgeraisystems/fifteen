import { useRef, useState } from 'react';
import { getProvider } from '../../core/provider/index.ts';
import { extractResumeText, ResumeReadError } from '../../core/resume/extract.ts';
import { parseProfile } from '../../core/resume/profile.ts';
import type { Profile } from '../../core/types.ts';
import { Icon } from './Icon.tsx';

const provider = getProvider(import.meta.env as Record<string, string | undefined>);

async function readProfile(file: File, nowIso: string): Promise<Profile> {
  // extract.ts lazy-loads pdf.js/mammoth itself, only when a file is dropped.
  const text = await extractResumeText(file);
  const fromModel = await provider.extractProfile(text, nowIso);
  return { ...parseProfile(text, nowIso), ...(fromModel ?? {}) };
}

/** Drop or pick a PDF/DOCX resume; parses it locally in the browser. */
export function ResumeDrop({
  nowIso,
  onParsed,
  compact = false,
}: {
  nowIso: string;
  onParsed: (p: Profile, fileName: string) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const p = await readProfile(file, nowIso);
      onParsed(p, file.name);
    } catch (e) {
      setError(e instanceof ResumeReadError ? e.message : 'We couldn’t read that file. Try a PDF or Word (.docx) export.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`drop ${over ? 'is-over' : ''} ${compact ? 'drop-compact' : ''}`}>
      <div
        className="drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
      >
        <span className="state-icon" aria-hidden="true">
          <Icon name="upload" />
        </span>
        <div>
          <p className="drop-title">{busy ? 'Reading your resume…' : compact ? 'Drop a new resume' : 'Drop your resume here'}</p>
          <p className="field-hint">PDF or Word (.docx), up to 5 MB. It’s read on this device.</p>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          Choose file
        </button>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label="Upload resume"
          data-testid="resume-input"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      ) : null}
    </div>
  );
}
