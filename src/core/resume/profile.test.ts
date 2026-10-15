import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../../../e2e/fixtures/resumes/personas.ts';
import { classYearFromGrad, parseProfile } from './profile.ts';

/** Fixed "today" for every test: fall 2026, academic year ending spring 2027. */
const NOW = '2026-10-15T12:00:00.000Z';

describe('persona resumes (text)', () => {
  for (const persona of PERSONAS) {
    describe(persona.slug, () => {
      const text = persona.lines.join('\n');
      const profile = parseProfile(text, NOW);
      const want = persona.expected;

      it('reads the basics', () => {
        expect(profile.name).toBe(want.name);
        expect(profile.email).toBe(want.email);
        expect(profile.school).toBe(want.school);
        expect(profile.gpa).toBe(want.gpa);
        expect(profile.gradYear).toBe(want.gradYear);
        expect(classYearFromGrad(profile.gradYear, NOW)).toBe(want.classYear);
      });

      it('finds majors', () => {
        for (const id of want.majors) expect(profile.majors, id).toContain(id);
        for (const id of profile.majors) expect(id.startsWith('major:')).toBe(true);
      });

      it('finds skills and no false positives', () => {
        for (const id of want.skills) expect(profile.skills, id).toContain(id);
        for (const id of want.notSkills) expect(profile.skills, id).not.toContain(id);
        for (const id of profile.skills) expect(id.startsWith('major:'), id).toBe(false);
      });

      it('reads coursework', () => {
        for (const c of want.coursework) expect(profile.coursework, c).toContain(c);
        expect(profile.coursework.length).toBe(want.coursework.length);
      });

      it('reads experience entries', () => {
        const titles = profile.experience.map((e) => e.title);
        for (const t of want.titles) expect(titles, t).toContain(t);
        expect(profile.experience.length).toBeLessThanOrEqual(8);
      });

      it('counts words', () => {
        expect(profile.wordCount).toBe(text.split(/\s+/).filter(Boolean).length);
      });
    });
  }

  it('reads employers next to titles', () => {
    const sam = PERSONAS.find((p) => p.slug === 'junior-sam');
    const profile = parseProfile((sam?.lines ?? []).join('\n'), NOW);
    expect(profile.experience[0]).toEqual({ title: 'Logistics Intern', org: 'Midway Freight Solutions' });
    expect(profile.experience.find((e) => e.title === 'Captain')?.org).toBe('Northlake Club Volleyball');
  });
});

describe('classYearFromGrad', () => {
  it('maps graduation years onto class years for the academic year', () => {
    expect(classYearFromGrad(2027, NOW)).toBe('senior');
    expect(classYearFromGrad(2028, NOW)).toBe('junior');
    expect(classYearFromGrad(2029, NOW)).toBe('sophomore');
    expect(classYearFromGrad(2030, NOW)).toBe('freshman');
  });

  it('is null for graduated, far-future or missing years', () => {
    expect(classYearFromGrad(2025, NOW)).toBeNull();
    expect(classYearFromGrad(2031, NOW)).toBeNull();
    expect(classYearFromGrad(null, NOW)).toBeNull();
  });

  it('rolls over in August', () => {
    expect(classYearFromGrad(2028, '2027-06-01T00:00:00Z')).toBe('junior');
    expect(classYearFromGrad(2028, '2027-09-01T00:00:00Z')).toBe('senior');
  });
});

describe('messy formats', () => {
  it('ALL CAPS name and headings, "Anticipated Graduation", cumulative GPA, Major:/Minor: lines', () => {
    const text = [
      'RESUME',
      'JORDAN A. ELLIS',
      'jordan.a.ellis@school.edu   404.555.0111',
      '',
      'EDUCATION:',
      'GEORGIA LAKES UNIVERSITY   Atlanta, GA',
      'Major: Information Systems; Minor: Finance',
      'Anticipated Graduation: December 2027',
      'Cumulative GPA 3.45',
      'Relevant Coursework: Database Design,',
      'Systems Analysis, Corporate Finance',
      '',
      'WORK EXPERIENCE:',
      'IT Help Desk Intern - Lakes Health Network   Jun 2026 - Aug 2026',
      '• Resolved 40+ tickets a week using SQL queries and Excel',
      'SKILLS: Python, SQL, Excel',
    ].join('\n');
    const p = parseProfile(text, NOW);
    expect(p.name).toBe('Jordan A. Ellis');
    expect(p.email).toBe('jordan.a.ellis@school.edu');
    expect(p.school).toBe('Georgia Lakes University');
    expect(p.gpa).toBe(3.45);
    expect(p.gradYear).toBe(2027);
    expect(classYearFromGrad(p.gradYear, NOW)).toBe('senior');
    expect(p.majors).toEqual(expect.arrayContaining(['major:information-systems', 'major:finance']));
    expect(p.coursework).toEqual(['Database Design', 'Systems Analysis', 'Corporate Finance']);
    expect(p.skills).toEqual(expect.arrayContaining(['sql', 'excel', 'python', 'exp:internship']));
    expect(p.experience[0]).toEqual({ title: 'IT Help Desk Intern', org: 'Lakes Health Network' });
  });

  it('one dense line per section, bullets and pipes, "Class of" and a GPA written first', () => {
    const text = [
      'Alex Kim | alex.kim@stonebridge.edu | 555-0100 | Austin, TX',
      'EDUCATION',
      'Stonebridge College – B.A. Economics – 3.72 GPA – Class of 2029',
      'EXPERIENCE',
      'Research Assistant | Stonebridge Economics Dept | Jan 2026 - Present',
      'Tutor - Stonebridge Writing Center - 2025',
      'ACTIVITIES',
      'Founder, Stonebridge Chess Club',
    ].join('\n');
    const p = parseProfile(text, NOW);
    expect(p.name).toBe('Alex Kim');
    expect(p.school).toBe('Stonebridge College');
    expect(p.gpa).toBe(3.72);
    expect(p.gradYear).toBe(2029);
    expect(p.majors).toEqual(['major:economics']);
    expect(p.experience.map((e) => e.title)).toEqual(['Research Assistant', 'Tutor', 'Founder']);
    expect(p.experience[0]?.org).toBe('Stonebridge Economics Dept');
    expect(p.skills).toContain('exp:leadership');
    expect(p.skills).not.toContain('exp:internship');
  });

  it('other GPA scales, numeric months, a high-school line and lowercase headings', () => {
    const text = [
      'Taylor Brooks',
      'taylor.brooks@example.com',
      'education:',
      'Lincoln High School, Graduated June 2023',
      'University of Colorado Boulder, Boulder, CO',
      'Bachelor of Science in Business Administration (Accounting)',
      'GPA: 8.5/10   Expected Graduation: 05/2028',
      'experience',
      'Tax Intern, Mile High CPA Group (part-time)   2026',
      'Reconciled client ledgers in QuickBooks',
    ].join('\n');
    const p = parseProfile(text, NOW);
    expect(p.name).toBe('Taylor Brooks');
    expect(p.school).toBe('University of Colorado Boulder');
    expect(p.gpa).toBe(3.4);
    expect(p.gradYear).toBe(2028);
    expect(p.majors).toEqual(expect.arrayContaining(['major:business', 'major:accounting']));
    expect(p.experience[0]).toEqual({ title: 'Tax Intern', org: 'Mile High CPA Group' });
    expect(p.skills).toEqual(expect.arrayContaining(['quickbooks', 'tax', 'exp:internship']));
  });

  it('almost-empty input never throws and returns nulls and empty lists', () => {
    const p = parseProfile('References available upon request.\n\n', NOW);
    expect(p).toEqual({
      name: null,
      email: null,
      school: null,
      majors: [],
      gpa: null,
      gradYear: null,
      skills: [],
      coursework: [],
      experience: [],
      wordCount: 4,
    });
    expect(parseProfile('', NOW).wordCount).toBe(0);
  });

  it('ignores years outside the plausible window and out-of-range GPAs', () => {
    const text = ['Casey Doe', 'EDUCATION', 'Old College', 'B.S. Finance, Graduated 2009', 'GPA: 5.1'].join('\n');
    const p = parseProfile(text, NOW);
    expect(p.gradYear).toBeNull();
    expect(p.gpa).toBeNull();
  });

  it('treats text lines in the experience section that are not entries as noise', () => {
    const text = [
      'Riley Park',
      'EXPERIENCE',
      'Marketing Intern, Northside Foods   Jun 2026 - Aug 2026',
      'Responsible for weekly reports and for keeping the team calendar current in 2026',
    ].join('\n');
    const p = parseProfile(text, NOW);
    expect(p.experience).toEqual([{ title: 'Marketing Intern', org: 'Northside Foods' }]);
  });
});
