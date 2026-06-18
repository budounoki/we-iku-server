export interface GrowthStandardPoint {
  monthsAge: number;
  p3: number;
  p50: number;
  p97: number;
}

export const WEIGHT_STANDARDS_MALE: GrowthStandardPoint[] = [
  { monthsAge: 0, p3: 2.5, p50: 3.0, p97: 3.8 },
  { monthsAge: 1, p3: 3.4, p50: 4.2, p97: 5.2 },
  { monthsAge: 2, p3: 4.2, p50: 5.2, p97: 6.5 },
  { monthsAge: 3, p3: 4.8, p50: 6.0, p97: 7.5 },
  { monthsAge: 4, p3: 5.4, p50: 6.6, p97: 8.2 },
  { monthsAge: 5, p3: 5.8, p50: 7.1, p97: 8.7 },
  { monthsAge: 6, p3: 6.1, p50: 7.5, p97: 9.1 },
  { monthsAge: 7, p3: 6.4, p50: 7.8, p97: 9.5 },
  { monthsAge: 8, p3: 6.6, p50: 8.0, p97: 9.8 },
  { monthsAge: 9, p3: 6.8, p50: 8.2, p97: 10.0 },
  { monthsAge: 10, p3: 7.0, p50: 8.4, p97: 10.2 },
  { monthsAge: 11, p3: 7.1, p50: 8.6, p97: 10.4 },
  { monthsAge: 12, p3: 7.3, p50: 8.7, p97: 10.6 },
  { monthsAge: 15, p3: 7.7, p50: 9.2, p97: 11.2 },
  { monthsAge: 18, p3: 8.1, p50: 9.7, p97: 11.8 },
  { monthsAge: 21, p3: 8.5, p50: 10.2, p97: 12.3 },
  { monthsAge: 24, p3: 8.9, p50: 10.6, p97: 12.9 },
  { monthsAge: 30, p3: 9.6, p50: 11.5, p97: 14.0 },
  { monthsAge: 36, p3: 10.3, p50: 12.3, p97: 15.0 },
  { monthsAge: 42, p3: 10.9, p50: 13.1, p97: 16.0 },
  { monthsAge: 48, p3: 11.5, p50: 13.9, p97: 17.0 },
  { monthsAge: 54, p3: 12.1, p50: 14.7, p97: 18.0 },
  { monthsAge: 60, p3: 12.7, p50: 15.5, p97: 19.0 },
  { monthsAge: 66, p3: 13.3, p50: 16.3, p97: 20.1 },
  { monthsAge: 72, p3: 13.9, p50: 17.2, p97: 21.3 },
];

export const WEIGHT_STANDARDS_FEMALE: GrowthStandardPoint[] = [
  { monthsAge: 0, p3: 2.4, p50: 2.9, p97: 3.7 },
  { monthsAge: 1, p3: 3.2, p50: 3.9, p97: 4.8 },
  { monthsAge: 2, p3: 3.9, p50: 4.8, p97: 6.0 },
  { monthsAge: 3, p3: 4.5, p50: 5.5, p97: 6.9 },
  { monthsAge: 4, p3: 5.0, p50: 6.1, p97: 7.5 },
  { monthsAge: 5, p3: 5.4, p50: 6.5, p97: 8.0 },
  { monthsAge: 6, p3: 5.7, p50: 6.9, p97: 8.4 },
  { monthsAge: 7, p3: 6.0, p50: 7.2, p97: 8.7 },
  { monthsAge: 8, p3: 6.2, p50: 7.4, p97: 9.0 },
  { monthsAge: 9, p3: 6.4, p50: 7.6, p97: 9.2 },
  { monthsAge: 10, p3: 6.5, p50: 7.8, p97: 9.4 },
  { monthsAge: 11, p3: 6.7, p50: 7.9, p97: 9.6 },
  { monthsAge: 12, p3: 6.8, p50: 8.1, p97: 9.8 },
  { monthsAge: 15, p3: 7.2, p50: 8.6, p97: 10.5 },
  { monthsAge: 18, p3: 7.6, p50: 9.1, p97: 11.1 },
  { monthsAge: 21, p3: 8.0, p50: 9.6, p97: 11.7 },
  { monthsAge: 24, p3: 8.4, p50: 10.1, p97: 12.3 },
  { monthsAge: 30, p3: 9.1, p50: 10.9, p97: 13.4 },
  { monthsAge: 36, p3: 9.8, p50: 11.8, p97: 14.5 },
  { monthsAge: 42, p3: 10.4, p50: 12.6, p97: 15.5 },
  { monthsAge: 48, p3: 11.0, p50: 13.4, p97: 16.5 },
  { monthsAge: 54, p3: 11.6, p50: 14.2, p97: 17.5 },
  { monthsAge: 60, p3: 12.2, p50: 15.0, p97: 18.6 },
  { monthsAge: 66, p3: 12.8, p50: 15.9, p97: 19.7 },
  { monthsAge: 72, p3: 13.4, p50: 16.8, p97: 20.9 },
];

export const HEIGHT_STANDARDS_MALE: GrowthStandardPoint[] = [
  { monthsAge: 0, p3: 46.0, p50: 49.0, p97: 52.5 },
  { monthsAge: 1, p3: 50.0, p50: 53.5, p97: 57.0 },
  { monthsAge: 2, p3: 53.5, p50: 57.0, p97: 60.5 },
  { monthsAge: 3, p3: 56.5, p50: 60.0, p97: 63.5 },
  { monthsAge: 4, p3: 58.5, p50: 62.5, p97: 66.0 },
  { monthsAge: 5, p3: 60.5, p50: 64.5, p97: 68.0 },
  { monthsAge: 6, p3: 62.0, p50: 66.0, p97: 70.0 },
  { monthsAge: 7, p3: 63.5, p50: 67.5, p97: 71.5 },
  { monthsAge: 8, p3: 64.5, p50: 68.5, p97: 72.5 },
  { monthsAge: 9, p3: 65.5, p50: 70.0, p97: 74.0 },
  { monthsAge: 10, p3: 66.5, p50: 71.0, p97: 75.0 },
  { monthsAge: 11, p3: 67.5, p50: 72.0, p97: 76.0 },
  { monthsAge: 12, p3: 68.5, p50: 73.0, p97: 77.5 },
  { monthsAge: 15, p3: 71.5, p50: 76.5, p97: 81.0 },
  { monthsAge: 18, p3: 74.0, p50: 79.5, p97: 84.5 },
  { monthsAge: 21, p3: 76.5, p50: 82.0, p97: 87.5 },
  { monthsAge: 24, p3: 78.5, p50: 84.5, p97: 90.0 },
  { monthsAge: 30, p3: 82.5, p50: 88.5, p97: 94.5 },
  { monthsAge: 36, p3: 86.0, p50: 92.5, p97: 98.5 },
  { monthsAge: 42, p3: 89.0, p50: 95.5, p97: 102.0 },
  { monthsAge: 48, p3: 92.0, p50: 98.5, p97: 105.5 },
  { monthsAge: 54, p3: 95.0, p50: 101.5, p97: 108.5 },
  { monthsAge: 60, p3: 97.5, p50: 104.5, p97: 111.5 },
  { monthsAge: 66, p3: 100.0, p50: 107.0, p97: 114.5 },
  { monthsAge: 72, p3: 102.5, p50: 109.5, p97: 117.0 },
];

export const HEIGHT_STANDARDS_FEMALE: GrowthStandardPoint[] = [
  { monthsAge: 0, p3: 45.5, p50: 48.5, p97: 52.0 },
  { monthsAge: 1, p3: 49.5, p50: 52.5, p97: 56.0 },
  { monthsAge: 2, p3: 52.5, p50: 55.5, p97: 59.0 },
  { monthsAge: 3, p3: 55.0, p50: 58.5, p97: 62.0 },
  { monthsAge: 4, p3: 57.0, p50: 61.0, p97: 64.5 },
  { monthsAge: 5, p3: 59.0, p50: 63.0, p97: 66.5 },
  { monthsAge: 6, p3: 60.5, p50: 64.5, p97: 68.5 },
  { monthsAge: 7, p3: 62.0, p50: 66.0, p97: 70.0 },
  { monthsAge: 8, p3: 63.0, p50: 67.0, p97: 71.0 },
  { monthsAge: 9, p3: 64.0, p50: 68.5, p97: 72.5 },
  { monthsAge: 10, p3: 65.0, p50: 69.5, p97: 73.5 },
  { monthsAge: 11, p3: 66.0, p50: 70.5, p97: 74.5 },
  { monthsAge: 12, p3: 67.0, p50: 71.5, p97: 76.0 },
  { monthsAge: 15, p3: 70.0, p50: 75.0, p97: 80.0 },
  { monthsAge: 18, p3: 73.0, p50: 78.0, p97: 83.0 },
  { monthsAge: 21, p3: 75.5, p50: 81.0, p97: 86.0 },
  { monthsAge: 24, p3: 77.5, p50: 83.5, p97: 89.0 },
  { monthsAge: 30, p3: 81.5, p50: 87.5, p97: 93.5 },
  { monthsAge: 36, p3: 85.0, p50: 91.5, p97: 97.5 },
  { monthsAge: 42, p3: 88.0, p50: 94.5, p97: 101.0 },
  { monthsAge: 48, p3: 91.0, p50: 97.5, p97: 104.5 },
  { monthsAge: 54, p3: 94.0, p50: 100.5, p97: 107.5 },
  { monthsAge: 60, p3: 96.5, p50: 103.5, p97: 110.5 },
  { monthsAge: 66, p3: 99.0, p50: 106.5, p97: 113.5 },
  { monthsAge: 72, p3: 101.5, p50: 109.0, p97: 116.5 },
];

export function interpolateStandard(standards: GrowthStandardPoint[], monthsAge: number): { p3: number; p50: number; p97: number } | null {
  if (monthsAge < standards[0].monthsAge || monthsAge > standards[standards.length - 1].monthsAge) return null;
  
  for (let i = 0; i < standards.length - 1; i++) {
    const a = standards[i];
    const b = standards[i + 1];
    if (monthsAge >= a.monthsAge && monthsAge <= b.monthsAge) {
      const t = (monthsAge - a.monthsAge) / (b.monthsAge - a.monthsAge);
      return {
        p3: a.p3 + t * (b.p3 - a.p3),
        p50: a.p50 + t * (b.p50 - a.p50),
        p97: a.p97 + t * (b.p97 - a.p97),
      };
    }
  }
  return null;
}

export function buildStandardCurve(standards: GrowthStandardPoint[], maxMonths: number): { monthsAge: number; p3: number; p50: number; p97: number }[] {
  const result: { monthsAge: number; p3: number; p50: number; p97: number }[] = [];
  const cap = Math.min(maxMonths, standards[standards.length - 1].monthsAge);
  for (let m = 0; m <= cap; m++) {
    const val = interpolateStandard(standards, m);
    if (val) result.push({ monthsAge: m, ...val });
  }
  return result;
}
