/**
 * 2026 VA disability compensation — schedular rates only (no SMC).
 * Effective Dec 1, 2025.
 * Source: https://www.va.gov/disability/compensation-rates/veteran-rates/
 *
 * Dependent add-ons start at 30%. Additional-child amounts apply after the
 * first child already in the "1 child" basic rate.
 */
export type VaRating = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;

export const VA_RATINGS: VaRating[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export interface VaRateRow {
  veteranAlone: number;
  withSpouse: number;
  childOnly: number;
  childSpouse: number;
  additionalChild: number;
}

export const VA_RATES_2026: Record<VaRating, VaRateRow> = {
  10: { veteranAlone: 180.42, withSpouse: 180.42, childOnly: 180.42, childSpouse: 180.42, additionalChild: 0 },
  20: { veteranAlone: 356.66, withSpouse: 356.66, childOnly: 356.66, childSpouse: 356.66, additionalChild: 0 },
  30: { veteranAlone: 552.47, withSpouse: 617.47, childOnly: 596.47, childSpouse: 666.47, additionalChild: 32 },
  40: { veteranAlone: 795.84, withSpouse: 882.84, childOnly: 853.84, childSpouse: 947.84, additionalChild: 43 },
  50: { veteranAlone: 1132.9, withSpouse: 1241.9, childOnly: 1205.9, childSpouse: 1322.9, additionalChild: 54 },
  60: { veteranAlone: 1435.02, withSpouse: 1566.02, childOnly: 1523.02, childSpouse: 1663.02, additionalChild: 65 },
  70: { veteranAlone: 1808.45, withSpouse: 1961.45, childOnly: 1910.45, childSpouse: 2074.45, additionalChild: 76 },
  80: { veteranAlone: 2102.15, withSpouse: 2277.15, childOnly: 2219.15, childSpouse: 2406.15, additionalChild: 87 },
  90: { veteranAlone: 2362.3, withSpouse: 2559.3, childOnly: 2494.3, childSpouse: 2704.3, additionalChild: 98 },
  100: { veteranAlone: 3938.58, withSpouse: 4158.17, childOnly: 4085.43, childSpouse: 4318.99, additionalChild: 109.11 },
};

export function isVaRating(n: number): n is VaRating {
  return VA_RATINGS.includes(n as VaRating);
}
