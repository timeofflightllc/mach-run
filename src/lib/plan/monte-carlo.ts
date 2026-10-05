/** Standard deviation of the annual return, as a decimal. Typical is the default. */
export const SWING_PRESETS = {
  calm: 0.08,
  typical: 0.15,
  rough: 0.22,
} as const;

export type SwingName = keyof typeof SWING_PRESETS;

export const DEFAULT_SWING: SwingName = "typical";

/** Annual return cannot fall through -95%. Below that, monthly growth breaks. */
export const SHOCK_FLOOR = -0.95;

export function applyShock(statedAnnual: number, z: number, stdev: number): number {
  const drawn = statedAnnual + z * stdev;
  return drawn < SHOCK_FLOOR ? SHOCK_FLOOR : drawn;
}

/**
 * One standard-normal draw per call. Same seed, same sequence.
 * Uniforms are in (0, 1], so the log in Box-Muller never sees zero.
 */
export function createStandardNormal(seed: number): () => number {
  const nextUnit = mulberry32(seed);
  let spare: number | null = null;
  return function nextStandardNormal() {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    const u1 = nextUnit();
    const u2 = nextUnit();
    const magnitude = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    spare = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297;
  };
}
