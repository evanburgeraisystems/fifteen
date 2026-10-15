import { describe, expect, it } from 'vitest';
import { matchCities } from './index.ts';

describe('matchCities', () => {
  it('maps a single city', () => {
    expect(matchCities(['New York, NY'])).toEqual({ cities: ['nyc'], remote: false });
  });

  it('maps several cities from one multi-location string', () => {
    expect(matchCities(['Chicago, IL; San Francisco, CA'])).toEqual({ cities: ['chicago', 'sf-bay'], remote: false });
  });

  it('maps pipe-separated locations', () => {
    expect(matchCities(['Austin, TX | Dallas, TX'])).toEqual({ cities: ['austin', 'dallas'], remote: false });
  });

  it('flags remote and includes the remote city id', () => {
    expect(matchCities(['Remote - US'])).toEqual({ cities: ['remote'], remote: true });
    expect(matchCities(['Anywhere in the US'])).toEqual({ cities: ['remote'], remote: true });
  });

  it('keeps both the city and remote for "Remote (New York)"', () => {
    expect(matchCities(['Remote (New York)'])).toEqual({ cities: ['nyc', 'remote'], remote: true });
  });

  it('sends unknown and international locations to other', () => {
    expect(matchCities(['London, UK'])).toEqual({ cities: ['other'], remote: false });
    expect(matchCities(['Boise, ID'])).toEqual({ cities: ['other'], remote: false });
  });

  it('adds other alongside known cities when one location is unknown', () => {
    expect(matchCities(['Boston, MA', 'Tokyo, Japan'])).toEqual({ cities: ['boston', 'other'], remote: false });
  });

  it('dedupes across and within locations', () => {
    expect(matchCities(['Menlo Park, CA', 'Palo Alto, CA', 'San Francisco'])).toEqual({ cities: ['sf-bay'], remote: false });
  });

  it('maps DC-area and NYC-area suburbs', () => {
    expect(matchCities(['Washington, DC']).cities).toEqual(['dc']);
    expect(matchCities(['Arlington, VA']).cities).toEqual(['dc']);
    expect(matchCities(['Jersey City, NJ']).cities).toEqual(['nyc']);
  });

  it('never returns an empty list', () => {
    expect(matchCities([])).toEqual({ cities: ['other'], remote: false });
    expect(matchCities(['', '  '])).toEqual({ cities: ['other'], remote: false });
  });

  it('treats a bare descriptor like Hybrid as other, not remote', () => {
    expect(matchCities(['Hybrid'])).toEqual({ cities: ['other'], remote: false });
  });
});
