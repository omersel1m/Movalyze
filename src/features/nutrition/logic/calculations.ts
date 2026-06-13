import { Food, NutritionEntry, NutritionValues } from '../types/nutrition.types';

export function calculateEntryNutrition(
  food: Food,
  amount: number,
  unit: string,
): NutritionValues {
  // Besin değerleri serving_size başına verilmiştir.
  // amount * ratio ile ölçekliyoruz.
  let ratio: number;

  if (unit === 'serving') {
    ratio = amount;
  } else {
    // g veya ml: food.servingSize g/ml başına değerleri ölçekle
    ratio = (amount / food.servingSize) * 1;
  }

  return {
    calories: Math.round(food.calories * ratio * 10) / 10,
    carbsG:   Math.round(food.carbsG   * ratio * 10) / 10,
    proteinG: Math.round(food.proteinG * ratio * 10) / 10,
    fatG:     Math.round(food.fatG     * ratio * 10) / 10,
  };
}

export function sumDayTotals(
  entries: NutritionEntry[],
): { calories: number; carbsG: number; proteinG: number; fatG: number } {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      carbsG:   acc.carbsG   + e.carbsG,
      proteinG: acc.proteinG + e.proteinG,
      fatG:     acc.fatG     + e.fatG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fatG: 0 },
  );
}

export function calculateMacroPercentages(totals: {
  carbsG: number;
  proteinG: number;
  fatG: number;
}): { carbsPct: number; proteinPct: number; fatPct: number } {
  const carbCal   = totals.carbsG   * 4;
  const protCal   = totals.proteinG * 4;
  const fatCal    = totals.fatG     * 9;
  const total     = carbCal + protCal + fatCal;

  if (total === 0) return { carbsPct: 0, proteinPct: 0, fatPct: 0 };

  return {
    carbsPct:   Math.round((carbCal / total) * 100),
    proteinPct: Math.round((protCal / total) * 100),
    fatPct:     Math.round((fatCal  / total) * 100),
  };
}

export function getRemainingCalories(consumed: number, goal: number): number {
  return goal - consumed;
}

export function getProgressRatio(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.max(value / goal, 0), 1);
}
