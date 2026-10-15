/**
 * Deterministic randomness for the demo generator. mulberry32 with a fixed
 * seed: the same seed always yields the same stream, so regenerating the demo
 * data produces byte-identical files.
 */

export function hashString(s: string): number {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() from an empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Weighted choice over [value, weight] pairs. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) total += w;
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r < 0) return v;
    }
    const last = items[items.length - 1];
    if (!last) throw new Error('weighted() from an empty list');
    return last[0];
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = a[i] as T;
      a[i] = a[j] as T;
      a[j] = tmp;
    }
    return a;
  }

  /** n distinct items, uniformly. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)));
  }

  /**
   * n distinct items where earlier entries are more likely
   * (weight = length - index + 1).
   */
  sampleBiased<T>(items: readonly T[], n: number): T[] {
    const pool = items.map((v, i) => [v, items.length - i + 1] as const);
    const out: T[] = [];
    while (out.length < n && pool.length > 0) {
      let total = 0;
      for (const [, w] of pool) total += w;
      let r = this.next() * total;
      let idx = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= (pool[i] as readonly [T, number])[1];
        if (r < 0) {
          idx = i;
          break;
        }
      }
      const [picked] = pool.splice(idx, 1);
      if (picked) out.push(picked[0]);
    }
    return out;
  }
}
