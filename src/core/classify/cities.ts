/** Raw ATS location strings -> city ids + remote flag. */
import { CITY_PATTERNS } from '../taxonomy.ts';
import type { CityId } from '../types.ts';

export function matchCities(locations: string[]): { cities: CityId[]; remote: boolean } {
  const cities: CityId[] = [];
  let remote = false;
  const add = (id: CityId): void => {
    if (!cities.includes(id)) cities.push(id);
  };

  for (const loc of locations) {
    for (const part of loc.split(/[;|\n]+/)) {
      const p = part.trim().toLowerCase();
      if (!p) continue;
      let hit = false;
      for (const { id, patterns } of CITY_PATTERNS) {
        if (!patterns.some((re) => re.test(p))) continue;
        hit = true;
        if (id === 'remote') remote = true;
        add(id);
      }
      if (!hit) add('other');
    }
  }
  if (cities.length === 0) return { cities: ['other'], remote: false };
  return { cities, remote };
}
