import { describe, expect, it } from 'vitest';
import { dedupeKey, normalizeTitle } from '../cycle.ts';
import type { EmailClassification } from '../types.ts';
import { classifyEmail } from './classify.ts';
import { EMAIL_FIXTURES } from './fixtures.ts';
import { companySimilarity, companyTokens, matchEmailToCard, roleOverlap } from './match.ts';
import type { MatchCandidate } from './match.ts';

const card = (company: string, slug: string, title: string, n = 1): MatchCandidate => ({
  postingId: `demo:${slug}:${n}`,
  dedupeKey: dedupeKey(slug, normalizeTitle(title), 'summer-2027'),
  company,
  companySlug: slug,
  title,
});

const cls = (companyGuess: string | null, roleGuess: string | null): EmailClassification => ({
  kind: 'applied-confirmation',
  confidence: 0.9,
  companyGuess,
  roleGuess,
  evidence: [],
});

const CARDS: MatchCandidate[] = [
  card('Peachtree Brands', 'peachtree-brands', 'Marketing Intern - Atlanta', 1),
  card('Peachtree Brands', 'peachtree-brands', 'Supply Chain Intern', 2),
  card('Magnolia Media Group', 'magnolia-media-group', 'Brand Marketing Intern', 3),
  card('Larkspur Consumer Co.', 'larkspur-consumer-co', 'Social Media Marketing Intern', 4),
  card('Larkspur Consumer Co.', 'larkspur-consumer-co', 'Content Marketing Intern', 5),
  card('Northwind Capital', 'northwind-capital', 'Summer 2027 Investment Banking Analyst', 6),
  card('Northwind Advisory', 'northwind-advisory', 'Strategy Intern', 7),
  card('Halcyon Advisory', 'halcyon-advisory', 'Strategy & Advisory Intern', 8),
];

describe('company normalization', () => {
  it('drops legal suffixes and punctuation', () => {
    expect(companyTokens('Acme Capital LLC')).toEqual(['acme', 'capital']);
    expect(companyTokens('Larkspur Consumer Co.')).toEqual(['larkspur', 'consumer']);
    expect(companyTokens('The Acme Group, Inc.')).toEqual(['acme']);
    expect(companyTokens('Cinder & Oak Partners')).toEqual(['cinder', 'and', 'oak', 'partners']);
  });

  it('treats name variants and slugs as the same company', () => {
    expect(companySimilarity('Acme Capital LLC', 'Acme Capital', 'acmecapital')).toBe(1);
    expect(companySimilarity('acme capital', 'Acme Capital', 'acme-capital')).toBe(1);
    expect(companySimilarity('ACME-CAPITAL', 'Acme Capital Partners', 'acmecapital')).toBeGreaterThanOrEqual(0.9);
    expect(companySimilarity('Acmecapital', 'Acme Capital', 'acme-capital')).toBe(1);
  });

  it('keeps different companies apart', () => {
    expect(companySimilarity('Northwind Capital', 'Northwind Advisory', 'northwind-advisory')).toBeLessThan(0.6);
    expect(companySimilarity('Acme', 'Zenith Labs', 'zenith-labs')).toBe(0);
  });
});

describe('matchEmailToCard', () => {
  it('matches a single-role company on name alone', () => {
    const m = matchEmailToCard(cls('Magnolia Media Group', null), CARDS);
    expect(m?.postingId).toBe('demo:magnolia-media-group:3');
    expect(m?.confidence).toBeGreaterThanOrEqual(0.6);
    expect(m?.reason).toMatch(/Magnolia/);
  });

  it('is insensitive to case, punctuation and suffix', () => {
    expect(matchEmailToCard(cls('LARKSPUR CONSUMER', 'Social Media Marketing Intern'), CARDS)?.postingId).toBe('demo:larkspur-consumer-co:4');
    expect(matchEmailToCard(cls('halcyon advisory, llc', null), CARDS)?.postingId).toBe('demo:halcyon-advisory:8');
    expect(matchEmailToCard(cls('Northwind Capital Inc.', null), CARDS)?.postingId).toBe('demo:northwind-capital:6');
  });

  it('picks the right role among several at one company', () => {
    expect(matchEmailToCard(cls('Peachtree Brands', 'Marketing Intern'), CARDS)?.postingId).toBe('demo:peachtree-brands:1');
    expect(matchEmailToCard(cls('Peachtree Brands', 'Supply Chain Intern'), CARDS)?.postingId).toBe('demo:peachtree-brands:2');
    expect(matchEmailToCard(cls('Larkspur Consumer Co.', 'Content Marketing Intern'), CARDS)?.postingId).toBe('demo:larkspur-consumer-co:5');
    expect(matchEmailToCard(cls('Larkspur Consumer Co.', 'Social Media Marketing Intern'), CARDS)?.postingId).toBe('demo:larkspur-consumer-co:4');
  });

  it('does not guess between roles when the email names none', () => {
    expect(matchEmailToCard(cls('Peachtree Brands', null), CARDS)).toBeNull();
  });

  it('does not guess when the role is unrelated to every card', () => {
    expect(matchEmailToCard(cls('Peachtree Brands', 'Quantum Physics Researcher'), CARDS)).toBeNull();
  });

  it('returns null for unknown companies and for no company', () => {
    expect(matchEmailToCard(cls('Zenith Labs', 'Marketing Intern'), CARDS)).toBeNull();
    expect(matchEmailToCard(cls(null, 'Marketing Intern'), CARDS)).toBeNull();
    expect(matchEmailToCard(cls('Peachtree Brands', null), [])).toBeNull();
  });

  it('does not confuse two companies that share a first word', () => {
    expect(matchEmailToCard(cls('Northwind Advisory', null), CARDS)?.postingId).toBe('demo:northwind-advisory:7');
    // "Northwind" alone fits both companies: refuse to guess
    expect(matchEmailToCard(cls('Northwind', null), CARDS)).toBeNull();
  });

  it('refuses to match a single card when the email is clearly about another role', () => {
    const cards = [card('Acme Capital', 'acme-capital', 'Marketing Intern')];
    expect(matchEmailToCard(cls('Acme Capital', 'Software Engineer Intern'), cards)).toBeNull();
    expect(matchEmailToCard(cls('Acme Capital', 'Marketing Intern'), cards)?.confidence).toBeGreaterThan(0.9);
  });

  it('matches the persona fixture emails to the right demo cards', () => {
    const byId = new Map(EMAIL_FIXTURES.map((e) => [e.id, e]));
    const expectCard = (emailId: string, postingId: string | null) => {
      const email = byId.get(emailId);
      if (!email) throw new Error(`missing fixture ${emailId}`);
      expect(matchEmailToCard(classifyEmail(email), CARDS)?.postingId ?? null, emailId).toBe(postingId);
    };
    expectCard('peachtree-applied-greenhouse', 'demo:peachtree-brands:1');
    expectCard('peachtree-interview-invite', 'demo:peachtree-brands:1');
    expectCard('magnolia-assessment-lever', 'demo:magnolia-media-group:3');
    expectCard('larkspur-rejection-ashby', 'demo:larkspur-consumer-co:4');
    expectCard('larkspur-applied-boilerplate', 'demo:larkspur-consumer-co:5');
    expectCard('halcyon-rejection-filled', 'demo:halcyon-advisory:8');
    expectCard('northwind-offer', 'demo:northwind-capital:6');
    // no card tracked for this company
    expectCard('cinderoak-applied-ashby', null);
    expectCard('ironbridge-rejection-icims', null);
  });
});

describe('roleOverlap', () => {
  it('scores shared meaningful tokens, ignoring cycle words and "intern"', () => {
    expect(roleOverlap('Summer 2027 Marketing Intern', 'Marketing Intern - Atlanta')).toBeGreaterThan(0.9);
    expect(roleOverlap('Brand Marketing Intern', 'Marketing Intern')).toBeGreaterThan(0.6);
    expect(roleOverlap('Supply Chain Intern', 'Marketing Intern')).toBe(0);
  });
});
