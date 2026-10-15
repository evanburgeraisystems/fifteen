import { describe, expect, it } from 'vitest';
import { extractCompensationFromText } from './index.ts';

describe('extractCompensationFromText: pay found', () => {
  it('reads an hourly range', () => {
    const c = extractCompensationFromText('The pay range for this internship is $25.00 - $30.00 per hour.');
    expect(c).toEqual({ min: 25, max: 30, unit: 'hour', currency: 'USD', source: 'description', raw: '$25.00 - $30.00 per hour' });
  });

  it('reads a single $/hr rate', () => {
    const c = extractCompensationFromText('Compensation: $25/hr plus overtime eligibility.');
    expect(c).toMatchObject({ min: 25, max: 25, unit: 'hour', raw: '$25/hr' });
  });

  it('reads a monthly stipend range', () => {
    const c = extractCompensationFromText('Interns receive a stipend of $4,800 - $5,200 per month.');
    expect(c).toMatchObject({ min: 4800, max: 5200, unit: 'month' });
  });

  it('reads an annual range with "annually"', () => {
    const c = extractCompensationFromText('Base compensation: $90,000-$110,000 annually, depending on experience.');
    expect(c).toMatchObject({ min: 90000, max: 110000, unit: 'year' });
  });

  it('reads a salary range with no explicit unit as annual', () => {
    const c = extractCompensationFromText('The salary range for this role is $85,000 - $95,000.');
    expect(c).toMatchObject({ min: 85000, max: 95000, unit: 'year' });
  });

  it('reads weekly pay', () => {
    const c = extractCompensationFromText('Summer interns earn $1,500 weekly.');
    expect(c).toMatchObject({ min: 1500, max: 1500, unit: 'week' });
  });

  it('reads "hourly rate of $40"', () => {
    const c = extractCompensationFromText('This role has an hourly rate of $40 for the 10-week program.');
    expect(c).toMatchObject({ min: 40, max: 40, unit: 'hour' });
  });

  it('reads "$25 - $30 USD per hour" and "an hour"', () => {
    expect(extractCompensationFromText('Pay: $25 - $30 USD per hour')).toMatchObject({ min: 25, max: 30, unit: 'hour' });
    expect(extractCompensationFromText('We pay $22 an hour.')).toMatchObject({ min: 22, max: 22, unit: 'hour' });
  });

  it('reads k-suffixed salaries', () => {
    const c = extractCompensationFromText('Salary: $90k - $110k per year');
    expect(c).toMatchObject({ min: 90000, max: 110000, unit: 'year' });
  });

  it('returns the first credible range when several are present', () => {
    const c = extractCompensationFromText('Intern pay is $28 - $32 per hour. Full-time analysts earn $85,000 - $95,000 per year.');
    expect(c).toMatchObject({ min: 28, max: 32, unit: 'hour' });
  });
});

describe('extractCompensationFromText: non-pay dollars are ignored', () => {
  it.each([
    'We manage over $10B in assets for institutional clients.',
    'The company raised $25 million in Series B funding.',
    'A relocation stipend of $2,000 is available for eligible interns.',
    'Tuition reimbursement of up to $5,250 per year.',
    'Includes a $5,000 sign-on bonus.',
    'Win a $50,000 prize in our hackathon.',
    'Housing stipend of $3,000 per month is provided.',
    'Our clients hold more than $500 billion in AUM.',
    'No pay information is listed here.',
  ])('%s -> null', (text) => {
    expect(extractCompensationFromText(text)).toBeNull();
  });

  it('skips non-pay dollars and still finds the real pay line', () => {
    const c = extractCompensationFromText('Relocation stipend of $3,000. We manage $2B in assets. Pay: $28 - $32 per hour.');
    expect(c).toMatchObject({ min: 28, max: 32, unit: 'hour' });
  });

  it('rejects implausible amounts for the stated unit', () => {
    expect(extractCompensationFromText('$2 per hour')).toBeNull();
  });

  it('does not treat a monthly housing allowance as pay', () => {
    expect(extractCompensationFromText('You also get a $500 monthly housing allowance.')).toBeNull();
  });
});
