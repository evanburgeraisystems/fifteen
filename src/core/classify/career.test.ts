import { describe, expect, it } from 'vitest';
import type { CareerId, IndustryId } from '../types.ts';
import { classifyRole } from './index.ts';

type Row = [title: string, department: string | null, industry: IndustryId, expected: CareerId];

const TITLE_CASES: Row[] = [
  ['Investment Banking Summer Analyst', null, 'finance', 'investment-banking'],
  ['Summer Analyst - Mergers & Acquisitions', null, 'finance', 'investment-banking'],
  ['Leveraged Finance Summer Analyst', null, 'finance', 'investment-banking'],
  ['Capital Markets Summer Associate', null, 'finance', 'investment-banking'],
  ['Global Markets Summer Analyst - Sales & Trading', null, 'finance', 'sales-trading'],
  ['Quantitative Trading Intern', null, 'finance', 'sales-trading'],
  ['Equity Research Summer Analyst', null, 'finance', 'asset-management'],
  ['Private Equity Intern', null, 'finance', 'asset-management'],
  ['Wealth Management Intern', null, 'finance', 'asset-management'],
  ['Venture Capital Fellow', null, 'finance', 'asset-management'],
  ['FP&A Intern', null, 'technology', 'corporate-finance'],
  ['Corporate Finance Summer Intern', null, 'consumer', 'corporate-finance'],
  ['Treasury Intern', null, 'industrials', 'corporate-finance'],
  ['Management Consulting Summer Associate', null, 'consulting', 'consulting'],
  ['Strategy & Operations Intern', null, 'consulting', 'strategy'],
  ['Corporate Development Intern', null, 'technology', 'strategy'],
  ['Audit Intern', null, 'accounting', 'accounting'],
  ['Tax Summer Associate', null, 'accounting', 'accounting'],
  ['Brand Marketing Intern', null, 'consumer', 'marketing'],
  ['Social Media & Content Intern', null, 'media', 'marketing'],
  ['Communications Intern', null, 'public-sector', 'marketing'],
  ['Business Development Intern', null, 'technology', 'sales'],
  ['Sales Development Representative Intern', null, 'technology', 'sales'],
  ['Operations Intern', null, 'consumer', 'operations'],
  ['Supply Chain Intern', null, 'industrials', 'supply-chain'],
  ['Procurement Intern', null, 'consumer', 'supply-chain'],
  ['Business Analyst Intern', null, 'healthcare', 'business-analytics'],
  ['Data Analyst Intern', null, 'media', 'business-analytics'],
  ['Associate Product Manager Intern', null, 'technology', 'product-management'],
  ['Technical Recruiter Intern', null, 'technology', 'people-hr'],
  ['Human Resources Intern', null, 'healthcare', 'people-hr'],
  ['Real Estate Investment Intern', null, 'real-estate', 'real-estate'],
  ['Acquisitions Analyst Intern', null, 'real-estate', 'real-estate'],
  ['Software Engineer Intern', null, 'technology', 'software-engineering'],
  ['Software Engineer Intern, Trading Systems', null, 'finance', 'software-engineering'],
  ['Machine Learning Engineer Intern', null, 'technology', 'software-engineering'],
  ['Data Scientist Intern', null, 'technology', 'data-science'],
  ['Product Designer Intern', null, 'technology', 'design'],
  ['UX Research Intern', null, 'technology', 'design'],
  ['Research Scientist Intern', null, 'technology', 'research'],
];

describe('classifyRole: title decides', () => {
  it.each(TITLE_CASES)('%s (%s, %s) -> %s', (title, department, industry, expected) => {
    const c = classifyRole({ title, department, description: '', companyIndustry: industry });
    expect(c.career).toBe(expected);
    expect(c.method).toBe('rules');
    expect(c.confidence).toBeGreaterThanOrEqual(0.8);
    expect(c.evidence[0]).toBe(`title: "${title}"`);
  });
});

describe('classifyRole: other behaviors', () => {
  it('assigns the family from the taxonomy', () => {
    const biz = classifyRole({ title: 'Marketing Intern', department: null, description: '', companyIndustry: 'consumer' });
    expect(biz.family).toBe('business');
    const eng = classifyRole({ title: 'Software Engineer Intern', department: null, description: '', companyIndustry: 'technology' });
    expect(eng.family).toBe('engineering');
    const design = classifyRole({ title: 'Product Designer Intern', department: null, description: '', companyIndustry: 'technology' });
    expect(design.family).toBe('design');
    const sci = classifyRole({ title: 'Research Scientist Intern', department: null, description: '', companyIndustry: 'technology' });
    expect(sci.family).toBe('science');
  });

  it('falls to the department with mid confidence when the title is generic', () => {
    const c = classifyRole({ title: 'Summer Analyst', department: 'Investment Banking', description: 'Join a deal team.', companyIndustry: 'finance' });
    expect(c.career).toBe('investment-banking');
    expect(c.confidence).toBeGreaterThanOrEqual(0.5);
    expect(c.confidence).toBeLessThan(0.8);
    expect(c.evidence).toEqual(['department: "Investment Banking"']);
  });

  it('maps single-word departments (Product, People, Technology)', () => {
    const base = { title: 'Summer Intern', description: '', companyIndustry: 'technology' as IndustryId };
    expect(classifyRole({ ...base, department: 'Product' }).career).toBe('product-management');
    expect(classifyRole({ ...base, department: 'People' }).career).toBe('people-hr');
    expect(classifyRole({ ...base, department: 'Technology' }).career).toBe('software-engineering');
  });

  it('boosts confidence when title and department agree', () => {
    const solo = classifyRole({ title: 'Marketing Intern', department: null, description: '', companyIndustry: 'consumer' });
    const both = classifyRole({ title: 'Marketing Intern', department: 'Marketing', description: '', companyIndustry: 'consumer' });
    expect(both.confidence).toBeGreaterThan(solo.confidence);
    expect(both.evidence).toHaveLength(2);
  });

  it('keeps the title when the department disagrees', () => {
    const c = classifyRole({ title: 'Sales Intern', department: 'Marketing', description: '', companyIndustry: 'technology' });
    expect(c.career).toBe('sales');
  });

  it('uses description keywords as a low-confidence last resort', () => {
    const c = classifyRole({
      title: 'Summer Intern',
      department: null,
      description:
        'You will support M&A transactions, build pitch books, and help with deal execution alongside the coverage group.',
      companyIndustry: 'finance',
    });
    expect(c.career).toBe('investment-banking');
    expect(c.confidence).toBeLessThan(0.5);
    expect(c.evidence[0]?.startsWith('description:')).toBe(true);
  });

  it('returns other with minimal confidence when nothing matches', () => {
    const c = classifyRole({ title: 'Summer Intern', department: null, description: 'Come work with great people.', companyIndustry: 'media' });
    expect(c.career).toBe('other');
    expect(c.family).toBe('other');
    expect(c.confidence).toBeLessThan(0.5);
    expect(c.industry).toBe('media');
  });

  it('keeps the company industry hint by default', () => {
    const c = classifyRole({ title: 'Marketing Intern', department: null, description: 'Join the team.', companyIndustry: 'healthcare' });
    expect(c.industry).toBe('healthcare');
  });

  it('overrides industry to accounting on Big Four / audit-firm evidence', () => {
    const c = classifyRole({
      title: 'Audit & Assurance Intern',
      department: null,
      description: 'We are a Big Four audit firm serving public and private clients.',
      companyIndustry: 'consulting',
    });
    expect(c.career).toBe('accounting');
    expect(c.industry).toBe('accounting');
    expect(c.evidence.some((e) => e.startsWith('industry:'))).toBe(true);
  });

  it('puts banking, trading and asset-management roles in finance even when the hint says otherwise', () => {
    const c = classifyRole({ title: 'Investment Banking Summer Analyst', department: null, description: '', companyIndustry: 'consulting' });
    expect(c.industry).toBe('finance');
  });

  it('does not treat the word business in "our business" as a career signal', () => {
    const c = classifyRole({ title: 'Summer Intern', department: null, description: 'Our business is growing and we love our customers.', companyIndustry: 'consumer' });
    expect(c.career).toBe('other');
  });

  it('routes financial advisory research desks at finance firms to asset management', () => {
    const c = classifyRole({ title: 'Research Analyst Intern', department: 'Research', description: '', companyIndustry: 'finance' });
    expect(c.career).toBe('asset-management');
    const sci = classifyRole({ title: 'Research Intern', department: null, description: '', companyIndustry: 'healthcare' });
    expect(sci.career).toBe('research');
  });

  it('does not confuse similar words (markets vs marketing, internal vs intern)', () => {
    expect(classifyRole({ title: 'Marketing Intern', department: null, description: '', companyIndustry: 'finance' }).career).toBe('marketing');
    expect(classifyRole({ title: 'Internal Audit Intern', department: null, description: '', companyIndustry: 'finance' }).career).toBe('accounting');
  });
});

describe('hardware internships stay out of business careers (live-data regression)', () => {
  it.each(['Avionics Intern (Summer 2027)', 'Antenna Intern (Summer 2027)', 'FPGA Intern (Summer 2027)', 'Harness Manufacturing Intern (Summer 2027)'])('%s', (title) => {
    const c = classifyRole({ title, department: null, description: 'Our recruiting team will reach out. Work with the RF team on hardware.', companyIndustry: 'industrials' });
    expect(c.family).not.toBe('business');
  });
});
