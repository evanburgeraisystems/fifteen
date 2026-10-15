import { describe, expect, it } from 'vitest';
import { extractEligibility } from './index.ts';

const Y = 2027; // summer 2027 recruiting cycle

describe('extractEligibility', () => {
  it('reads "rising junior" as the class that graduates two years after the summer', () => {
    const e = extractEligibility('Summer Analyst', 'Open to rising juniors.', Y);
    expect(e.gradYears).toEqual([2029]);
    expect(e.phrases).toContain('rising juniors');
  });

  it('handles a list of rising classes', () => {
    const e = extractEligibility('Summer Analyst', 'We are looking for rising juniors and seniors from any major.', Y);
    expect(e.gradYears).toEqual([2028, 2029]);
  });

  it('rising senior graduates the next spring; rising sophomore graduates in 2030', () => {
    expect(extractEligibility('', 'Applicants must be a rising senior.', Y).gradYears).toEqual([2028]);
    expect(extractEligibility('', 'Designed for a rising sophomore.', Y).gradYears).toEqual([2030]);
  });

  it('treats a sophomore program as sophomore year during the cycle', () => {
    const e = extractEligibility('Sophomore Insight Program', 'A two-day introduction to our firm.', Y);
    expect(e.gradYears).toEqual([2029]);
    expect(e.phrases.some((p) => p.includes('sophomore'))).toBe(true);
  });

  it('maps freshman and first-year students to the class of 2030', () => {
    expect(extractEligibility('Freshman Leadership Program', '', Y).gradYears).toEqual([2030]);
    expect(extractEligibility('Exploration Program', 'Open to first-year students at partner schools.', Y).gradYears).toEqual([2030]);
  });

  it('reads "currently a junior"', () => {
    const e = extractEligibility('Intern', 'You are currently a junior pursuing a business degree.', Y);
    expect(e.gradYears).toEqual([2028]);
  });

  it('reads "penultimate year" as junior', () => {
    expect(extractEligibility('Intern', 'Students in their penultimate year of study.', Y).gradYears).toEqual([2028]);
  });

  it('reads "graduating in 2028"', () => {
    const e = extractEligibility('Summer Intern', 'Candidates graduating in May 2028 are encouraged to apply.', Y);
    expect(e.gradYears).toEqual([2028]);
  });

  it('reads a graduation window and maps December Y to Y', () => {
    const e = extractEligibility(
      'Summer Analyst',
      'Expected graduation between December 2027 and June 2028. Strong academics required.',
      Y,
    );
    expect(e.gradYears).toEqual([2027, 2028]);
    expect(e.evidence).toContain('Expected graduation between December 2027 and June 2028');
  });

  it('reads "Class of 2028" and lists of classes', () => {
    expect(extractEligibility('', 'This program is for the Class of 2028.', Y).gradYears).toEqual([2028]);
    expect(extractEligibility('', 'Open to the classes of 2028 and 2029.', Y).gradYears).toEqual([2028, 2029]);
  });

  it('reads a year range for undergraduates', () => {
    const e = extractEligibility('Intern', 'We hire undergraduate students graduating 2027-2028 into this role.', Y);
    expect(e.gradYears).toEqual([2027, 2028]);
  });

  it('reads "must be a current sophomore or junior"', () => {
    const e = extractEligibility('Intern', 'You must be a current sophomore or junior at an accredited university.', Y);
    expect(e.gradYears).toEqual([2028, 2029]);
  });

  it('reads "entering your junior year" as a rising junior', () => {
    expect(extractEligibility('Intern', 'Students entering their junior year this fall.', Y).gradYears).toEqual([2029]);
  });

  it('reads eligibility from the title too', () => {
    const e = extractEligibility('Summer 2027 Analyst (Rising Seniors)', 'Work on live deals.', Y);
    expect(e.gradYears).toEqual([2028]);
  });

  it('reads "2028 graduates"', () => {
    expect(extractEligibility('Intern', 'Open to 2028 graduates only.', Y).gradYears).toEqual([2028]);
  });

  it('returns nothing when no class year is stated', () => {
    const e = extractEligibility('Marketing Intern', 'Work with our brand team on campaigns this summer.', Y);
    expect(e).toEqual({ gradYears: [], phrases: [], evidence: null });
  });

  it('does not read job levels as class years', () => {
    const e = extractEligibility(
      'Junior Analyst',
      'Report to the Senior Manager and a senior leadership team. Our junior analysts rotate across desks. Senior Associate mentors help.',
      Y,
    );
    expect(e.gradYears).toEqual([]);
  });

  it('ignores graduate degrees and old graduation years', () => {
    const e = extractEligibility('Research Intern', 'A graduate degree is a plus. Our founder graduated from MIT in 2009.', Y);
    expect(e.gradYears).toEqual([]);
  });

  it('keeps the evidence snippet within 160 characters and centred on the match', () => {
    const filler = 'This is a long sentence about our company culture and many other things that go on and on, '.repeat(4);
    const e = extractEligibility('Intern', `${filler}we recruit rising juniors for this role, ${filler}`, Y);
    expect(e.gradYears).toEqual([2029]);
    expect(e.evidence).not.toBeNull();
    expect(e.evidence?.length).toBeLessThanOrEqual(160);
    expect(e.evidence).toContain('rising juniors');
  });
});
