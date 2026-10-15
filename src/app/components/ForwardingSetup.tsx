import { useState } from 'react';
import { useAppState } from '../state/store.ts';
import { Icon } from './Icon.tsx';

/**
 * Email forwarding, explained in one sentence. Skip is a first-class choice.
 * The app never asks for inbox access.
 */
export function ForwardingSetup({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const { forwarding } = useAppState();
  const [copied, setCopied] = useState(false);
  return (
    <div className="forward">
      <p className="onboard-sub">
        One Gmail filter forwards recruiting emails to your private address, and confirmations, assessments and interviews move your tracker for
        you. We never see the rest of your inbox.
      </p>
      <div className="forward-address">
        <span className="field-label">Your forwarding address</span>
        <div className="copy-row">
          <code data-testid="forward-address">{forwarding.address}</code>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(forwarding.address).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <details className="forward-steps">
        <summary>How to set up the Gmail filter (2 minutes)</summary>
        <ol>
          <li>In Gmail, open Settings → Forwarding and add the address above.</li>
          <li>Create a filter with “Has the words”: <code>application OR applying OR assessment OR interview OR offer</code>.</li>
          <li>Choose “Forward it to” your Fifteen address and save.</li>
        </ol>
      </details>
      <p className="notice-inline" data-testid="forward-preview-note">
        <Icon name="info" size={15} /> Preview: this address starts receiving mail when inbound email launches. Until then, paste a forwarded email in Settings → Email forwarding.
      </p>
      <div className="onboard-actions">
        <button type="button" className="btn btn-secondary" onClick={onSkip} data-testid="skip-forwarding">
          Skip for now
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          I set up the filter <Icon name="arrow-right" size={16} />
        </button>
      </div>
      <p className="field-hint">Skipping is fine: you can confirm applications yourself with one tap. Turn this on anytime in Settings.</p>
    </div>
  );
}
