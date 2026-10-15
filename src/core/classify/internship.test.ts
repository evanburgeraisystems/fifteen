import { describe, expect, it } from 'vitest';
import { detectInternship } from './index.ts';

describe('detectInternship: positives', () => {
  it.each<[string, string]>([
    ['Investment Banking Summer Analyst', ''],
    ['Summer 2027 Analyst Program - Global Markets', ''],
    ['Software Engineer Intern', 'Build features with our platform team.'],
    ['Marketing Internship (Summer 2027)', ''],
    ['Finance Intern - New York', ''],
    ['Data Science Interns', ''],
    ['Co-op Student, Supply Chain', ''],
    ['Cooperative Education Student - Accounting', ''],
    ['Summer Associate, Real Estate', ''],
    ['Summer Scholar Program', ''],
    ['Sophomore Insight Program', 'Learn about careers in banking.'],
    ['Early Identification Program - Consulting', ''],
    ['Freshman Leadership Program', ''],
    ['Spring Week: Sales & Trading', ''],
    ['2027 Summer Analyst - Technology Banking', ''],
    ['Strategy Intern, Fall 2026', ''],
    ['Business Analyst Co-Op', ''],
    ['Product Management Internship', 'Own a project end to end.'],
  ])('%s -> true', (title, desc) => {
    expect(detectInternship(title, desc)).toBe(true);
  });

  it('lets a strong description phrase tip an otherwise silent program title', () => {
    expect(
      detectInternship('Rotational Analyst Program', 'This is a 10-week summer internship program for rising seniors at partner schools.'),
    ).toBe(true);
  });

  it('title intern wins over new-grad wording', () => {
    expect(detectInternship('Analyst Intern / New Grad Pipeline', '')).toBe(true);
  });
});

describe('detectInternship: negatives', () => {
  it.each<[string, string]>([
    ['Investment Banking Analyst', 'Full-time analyst role in our New York office.'],
    ['Analyst', 'Join our team as a financial analyst.'],
    ['Junior Analyst, Operations', ''],
    ['Software Engineer, New Grad 2027', ''],
    ['Internal Audit Manager', 'Lead internal audit engagements.'],
    ['International Sales Associate', ''],
    ['Interim Controller', ''],
    ['Apprentice Electrician', 'Earn while you learn on the job.'],
    ['Software Apprenticeship Program', ''],
    ['Intern Program Manager', 'Run our summer intern program.'],
    ['Internship Program Manager, University Recruiting', ''],
    ['Intern Manager', ''],
    ['Early Careers Recruiter, Internships', ''],
    ['Former Intern Alumni Community Lead', ''],
    ['Senior Software Engineer', 'You will mentor interns each summer.'],
    ['Graduate Analyst Program', 'Full-time program for recent graduates.'],
    ['Senior Associate, Summer Operations', ''],
    ['Marketing Associate', 'Our interns love the culture. Full-time position.'],
    ['Sales Associate (Seasonal Summer Hours)', ''],
  ])('%s -> false', (title, desc) => {
    expect(detectInternship(title, desc)).toBe(false);
  });

  it('does not treat mentions of interns in the description as the job being an internship', () => {
    expect(detectInternship('Operations Associate', 'You will work alongside our interns and fellows.')).toBe(false);
  });
});
