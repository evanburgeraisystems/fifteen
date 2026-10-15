import { describe, expect, it } from 'vitest';
import { normalizeTitle } from '../cycle.ts';
import type { InboundEmail } from '../types.ts';
import { classifyEmail, parseSender } from './classify.ts';
import { EMAIL_EXPECTATIONS, EMAIL_FIXTURES } from './fixtures.ts';

const mail = (over: Partial<InboundEmail>): InboundEmail => ({
  id: 'x',
  from: 'Someone <someone@example.com>',
  subject: '',
  body: '',
  receivedAt: '2026-10-15T12:00:00.000Z',
  ...over,
});

describe('fixture emails', () => {
  it('has at least 18 fixtures covering every kind, each with an expectation', () => {
    expect(EMAIL_FIXTURES.length).toBeGreaterThanOrEqual(18);
    const kinds = new Set(Object.values(EMAIL_EXPECTATIONS).map((e) => e.kind));
    expect([...kinds].sort()).toEqual(['applied-confirmation', 'assessment', 'interview', 'offer', 'other', 'rejection']);
    for (const f of EMAIL_FIXTURES) expect(EMAIL_EXPECTATIONS[f.id], f.id).toBeDefined();
    expect(new Set(EMAIL_FIXTURES.map((f) => f.id)).size).toBe(EMAIL_FIXTURES.length);
  });

  for (const fixture of EMAIL_FIXTURES) {
    const want = EMAIL_EXPECTATIONS[fixture.id];
    describe(fixture.id, () => {
      const got = classifyEmail(fixture);
      it('kind', () => {
        expect(got.kind, JSON.stringify(got.evidence)).toBe(want?.kind);
      });
      if (want?.company !== undefined) {
        it('company', () => {
          expect(got.companyGuess, JSON.stringify(got.evidence)).toBe(want.company);
        });
      }
      if (want?.role !== undefined) {
        it('role', () => {
          expect(got.roleGuess, JSON.stringify(got.evidence)).not.toBeNull();
          expect(normalizeTitle(got.roleGuess ?? '')).toBe(normalizeTitle(want.role ?? ''));
        });
      }
      it('confidence and evidence', () => {
        expect(got.confidence).toBeGreaterThan(0.5);
        expect(got.confidence).toBeLessThanOrEqual(0.99);
        expect(got.evidence.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('conflict resolution', () => {
  it('rejection language wins over "thank you for applying"', () => {
    const got = classifyEmail(
      mail({
        subject: 'Thank you for applying to Acme',
        body: 'Thank you for applying. We have received your application. Unfortunately, we have decided to pursue other candidates.',
      }),
    );
    expect(got.kind).toBe('rejection');
  });

  it('"we offer a great culture" is not an offer', () => {
    const got = classifyEmail(
      mail({ subject: 'Why Acme', body: 'We offer a great culture, competitive pay and flexible hours.' }),
    );
    expect(got.kind).not.toBe('offer');
  });

  it('a conditional "if selected we will schedule an interview" stays an applied confirmation', () => {
    const got = classifyEmail(
      mail({
        subject: 'Application received',
        body: 'We have received your application. If selected, we will schedule an interview with you. Candidates may be asked to take an online assessment.',
      }),
    );
    expect(got.kind).toBe('applied-confirmation');
  });

  it('a later stage beats the "thank you for applying" it carries', () => {
    const got = classifyEmail(
      mail({
        subject: 'Interview with Acme',
        body: "Thank you for applying. We'd like to invite you to interview next week. Please schedule an interview here.",
      }),
    );
    expect(got.kind).toBe('interview');
  });

  it('a live video interview with a recruiter is an interview, a recorded one is an assessment', () => {
    const live = classifyEmail(mail({ subject: 'Your video interview', body: 'Your video interview with Sam is confirmed for Tuesday at 2pm on Zoom. Please schedule an interview time change if needed.' }));
    expect(live.kind).toBe('interview');
    const recorded = classifyEmail(mail({ subject: 'Your video interview', body: 'Please record your answers to the video interview questions at your convenience.' }));
    expect(recorded.kind).toBe('assessment');
  });

  it('unrelated mail is "other" with no invented company role', () => {
    const got = classifyEmail(mail({ subject: 'Lunch?', body: 'Want to grab lunch at noon?' }));
    expect(got.kind).toBe('other');
    expect(got.roleGuess).toBeNull();
  });

  it('SHL is only matched as the vendor, not the word "shell"', () => {
    const got = classifyEmail(mail({ subject: 'Seashell sale', body: 'Shell necklaces are 20% off.' }));
    expect(got.kind).toBe('other');
  });
});

describe('company guess', () => {
  it('strips ATS hosts and recruiting words from the display name', () => {
    const got = classifyEmail(
      mail({ from: '"Acme Recruiting" <no-reply@us.greenhouse-mail.io>', subject: 'Thanks for applying', body: 'We received your application.' }),
    );
    expect(got.companyGuess).toBe('Acme');
  });

  it('reads the company from "Your application to Acme" when the sender is a vendor', () => {
    const got = classifyEmail(
      mail({ from: 'Lever <no-reply@hire.lever.co>', subject: 'Your application to Acme Capital', body: 'We received your application.' }),
    );
    expect(got.companyGuess).toBe('Acme Capital');
  });

  it('reads the company from a signature line', () => {
    const got = classifyEmail(
      mail({
        from: 'Workday <no-reply@myworkday.com>',
        subject: 'Application status',
        body: 'Hello,\n\nWe received your application.\n\nThe Foxglove Analytics Recruiting Team',
      }),
    );
    expect(got.companyGuess).toBe('Foxglove Analytics');
  });

  it('falls back to the sender subdomain of an ATS host, then the sender domain', () => {
    const viaSub = classifyEmail(
      mail({ from: 'no-reply@acmerocket.icims.com', subject: 'Status', body: 'We received your application.' }),
    );
    expect(viaSub.companyGuess).toBe('Acmerocket');
    const viaDomain = classifyEmail(
      mail({ from: 'jobs@brightpath.example', subject: 'Status', body: 'We received your application.' }),
    );
    expect(viaDomain.companyGuess).toBe('Brightpath');
  });

  it('ignores a recruiter name as the display name', () => {
    const got = classifyEmail(
      mail({
        from: '"Taylor Brooks" <taylor.brooks@elmstreetfoods.example>',
        subject: 'Interview invitation: Operations Intern at Elm Street Foods',
        body: 'Please schedule an interview with us.',
      }),
    );
    expect(got.companyGuess).toBe('Elm Street Foods');
    expect(got.roleGuess).toBe('Operations Intern');
  });

  it('never returns an aggregator as the company', () => {
    const got = classifyEmail(
      mail({ from: '"Indeed" <alert@indeed.com>', subject: 'New jobs for you', body: 'Marketing Intern jobs. Unsubscribe.' }),
    );
    expect((got.companyGuess ?? '').toLowerCase()).not.toContain('indeed');
  });
});

describe('role guess', () => {
  it('reads "for the Summer 2027 Investment Banking Analyst position"', () => {
    const got = classifyEmail(
      mail({
        subject: 'Application received',
        body: 'Thank you for applying for the Summer 2027 Investment Banking Analyst position at Acme Capital.',
      }),
    );
    expect(got.roleGuess).toBe('Summer 2027 Investment Banking Analyst');
  });

  it('reads "ROLE - Company" subjects', () => {
    const got = classifyEmail(
      mail({ subject: 'Marketing Intern - Acme | Application Received', body: 'We have received your application.' }),
    );
    expect(got.roleGuess).toBe('Marketing Intern');
  });
});

describe('parseSender', () => {
  it('parses display names, quotes and bare addresses', () => {
    expect(parseSender('"Acme, Inc." <No-Reply@Acme.com>')).toMatchObject({ name: 'Acme, Inc.', local: 'no-reply', domain: 'acme.com' });
    expect(parseSender('jane@x.org')).toMatchObject({ name: null, local: 'jane', domain: 'x.org' });
  });
});
