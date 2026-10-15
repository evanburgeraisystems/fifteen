import { describe, expect, it } from 'vitest';
import { extractRequirements } from './index.ts';

const IB_POSTING = `About the role
Our summer analysts join live deal teams and support senior bankers. Our business serves corporate clients worldwide.

Responsibilities
• Build financial models and prepare pitch materials in PowerPoint
• Run comps and precedent transactions

Basic Qualifications
• Currently pursuing a bachelor's degree in finance, economics or accounting
• Cumulative GPA of 3.5 or higher
• Strong Excel skills

Preferred Qualifications
• Prior internship experience in banking
• Familiarity with Python or SQL is a plus
`;

describe('extractRequirements: sections', () => {
  const r = extractRequirements(IB_POSTING);

  it('puts qualification-section signals in required', () => {
    expect(r.required).toContain('excel');
    expect(r.required).not.toContain('powerpoint'); // responsibilities, not a requirement
    expect(r.required).not.toContain('valuation');
  });

  it('puts preferred-section signals in preferred and removes duplicates from required', () => {
    expect(r.preferred).toEqual(expect.arrayContaining(['exp:internship', 'python', 'sql']));
    for (const id of r.preferred) expect(r.required).not.toContain(id);
  });

  it('extracts majors only from degree sentences', () => {
    expect(r.majors).toEqual(expect.arrayContaining(['major:finance', 'major:economics', 'major:accounting']));
    expect(r.majors).not.toContain('major:business'); // "our business" is not a major
  });

  it('extracts the GPA floor', () => {
    expect(r.minGpa).toBe(3.5);
  });

  it('keeps major ids out of required and preferred', () => {
    expect([...r.required, ...r.preferred].some((id) => id.startsWith('major:'))).toBe(false);
  });
});

describe('extractRequirements: heading variants', () => {
  it('handles "What you\'ll need" and "Nice to have" headings', () => {
    const r = extractRequirements(
      ["What we do", "We run an e-commerce site.", "What you'll need", "- Experience with Tableau and SQL", "- Ability to analyze data", "Nice to have", "- Salesforce experience"].join('\n'),
    );
    expect(r.required).toEqual(expect.arrayContaining(['tableau', 'sql', 'data-analysis']));
    expect(r.preferred).toEqual(['salesforce']);
  });

  it('handles inline "Requirements:" and "Preferred:" headings on one line', () => {
    const r = extractRequirements('Requirements: proficiency in Excel and financial modeling. Preferred: Bloomberg Terminal experience.');
    expect(r.required).toEqual(expect.arrayContaining(['excel', 'financial-modeling']));
    expect(r.preferred).toEqual(['bloomberg']);
  });

  it('moves a "is a plus" line inside the required section to preferred', () => {
    const r = extractRequirements('Qualifications\n• Excel proficiency\n• Knowledge of SQL is a plus\n• Strong written communication skills');
    expect(r.required).toContain('excel');
    expect(r.required).toContain('trait:communication');
    expect(r.preferred).toEqual(['sql']);
  });

  it('treats "Minimum qualifications" as required and "Preferred" as preferred', () => {
    const r = extractRequirements('Minimum Qualifications:\nPython\nPreferred:\nTableau\nR Studio');
    expect(r.required).toEqual(['python']);
    expect(r.preferred).toEqual(expect.arrayContaining(['tableau', 'r-lang']));
  });

  it('does not mistake a sentence starting with "You have" for a heading', () => {
    const r = extractRequirements('Requirements\nYou have strong Excel skills and love spreadsheets\nResponsibilities\nUse Python daily');
    expect(r.required).toContain('excel');
    expect(r.required).not.toContain('python');
  });
});

describe('extractRequirements: no sections', () => {
  it('uses required/must/need lines as required and the rest as preferred', () => {
    const r = extractRequirements(
      [
        'Join our marketing team this summer and help with campaigns.',
        'You must be proficient in Excel.',
        'Experience with Canva or HubSpot would be great.',
      ].join('\n'),
    );
    expect(r.required).toContain('excel');
    expect(r.preferred).toEqual(expect.arrayContaining(['adobe-creative', 'hubspot']));
    expect(r.required).not.toContain('hubspot');
  });

  it('returns empty lists for text with no signals', () => {
    expect(extractRequirements('We are a friendly team that loves coffee.')).toEqual({ required: [], preferred: [], minGpa: null, majors: [] });
  });
});

describe('extractRequirements: majors', () => {
  it('reads a list of majors from a pursuing sentence', () => {
    const r = extractRequirements('Pursuing a bachelor\'s degree in business administration, marketing, communications or a related field.');
    expect(r.majors).toEqual(expect.arrayContaining(['major:business', 'major:marketing', 'major:communications']));
  });

  it('ignores field words that are not near a degree cue', () => {
    const r = extractRequirements('Our business and marketing teams collaborate on engineering projects every day.');
    expect(r.majors).toEqual([]);
  });

  it('does not let text before the degree cue count', () => {
    const r = extractRequirements('We support the business, and we hire students pursuing a degree in mathematics or computer science.');
    expect(r.majors).toEqual(expect.arrayContaining(['major:stem']));
    expect(r.majors).not.toContain('major:business');
  });
});

describe('extractRequirements: GPA', () => {
  it.each<[string, number | null]>([
    ['Candidates should have a 3.5 GPA or above.', 3.5],
    ['GPA of 3.3 or higher required.', 3.3],
    ['Minimum 3.0 GPA on a 4.0 scale.', 3.0],
    ['A minimum GPA of 3.2 is expected.', 3.2],
    ['Cumulative GPA: 3.0/4.0', 3.0],
    ['3.7+ GPA preferred', 3.7],
    ['Strong academic record (GPA on a 4.0 scale).', null],
    ['We value grades but have no cutoff.', null],
  ])('%s -> %s', (text, expected) => {
    expect(extractRequirements(text).minGpa).toBe(expected);
  });

  it('rejects impossible GPAs', () => {
    expect(extractRequirements('GPA of 9.5 or higher').minGpa).toBeNull();
  });
});
