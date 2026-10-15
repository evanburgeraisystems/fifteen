import { describe, expect, it } from 'vitest';
import { isUsOrRemote } from './geo.ts';
import type { CityId } from './types.ts';

const p = (locations: string[], cities: CityId[] = ['other'], title = 'Intern', remote = false) => ({ locations, cities, title, remote });

describe('isUsOrRemote', () => {
  it('keeps US cities and states', () => {
    expect(isUsOrRemote(p(['New York, NY'], ['nyc']))).toBe(true);
    expect(isUsOrRemote(p(['Columbus, OH']))).toBe(true);
    expect(isUsOrRemote(p(['Remote - United States'], ['remote']))).toBe(true);
    expect(isUsOrRemote(p(['Nashville, Tennessee']))).toBe(true);
  });
  it('drops clearly non-US roles', () => {
    expect(isUsOrRemote(p(['London, UK']))).toBe(false);
    expect(isUsOrRemote(p(['Tokyo']))).toBe(false);
    expect(isUsOrRemote(p(['Remote - EMEA'], ['remote']))).toBe(false);
    expect(isUsOrRemote(p([], ['other'], 'Internship (m/w/d), Client Service, German Speaker'))).toBe(false);
  });
  it('keeps a multi-location role with any US office', () => {
    expect(isUsOrRemote(p(['London, UK', 'Chicago, IL'], ['chicago']))).toBe(true);
  });
  it('keeps roles that do not say where', () => {
    expect(isUsOrRemote(p(['Hybrid']))).toBe(true);
  });
});
