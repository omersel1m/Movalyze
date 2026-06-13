import {
  calculateEntryNutrition,
  sumDayTotals,
  calculateMacroPercentages,
  getRemainingCalories,
  getProgressRatio,
} from '../../src/features/nutrition/logic/calculations';
import { Food, NutritionEntry } from '../../src/features/nutrition/types/nutrition.types';

const CHICKEN: Food = {
  id: 'food-1',
  name: 'Tavuk Göğsü',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  carbsG: 0,
  proteinG: 31,
  fatG: 3.6,
  isUserCreated: false,
};

const RICE: Food = {
  id: 'food-2',
  name: 'Pirinç (pişmiş)',
  servingSize: 100,
  servingUnit: 'g',
  calories: 130,
  carbsG: 28.7,
  proteinG: 2.7,
  fatG: 0.3,
  isUserCreated: false,
};

describe('calculateEntryNutrition', () => {
  it('1 serving ile besin değerini doğru hesaplar', () => {
    const result = calculateEntryNutrition(CHICKEN, 1, 'serving');
    expect(result.calories).toBe(165);
    expect(result.proteinG).toBe(31);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBe(3.6);
  });

  it('gram bazlı hesaplamada ölçekleme doğru yapılır', () => {
    const result = calculateEntryNutrition(CHICKEN, 200, 'g');
    expect(result.calories).toBe(330);
    expect(result.proteinG).toBe(62);
  });

  it('yarım porsiyon (0.5 serving) doğru hesaplanır', () => {
    const result = calculateEntryNutrition(RICE, 0.5, 'serving');
    expect(result.calories).toBe(65);
    expect(result.carbsG).toBe(14.4);
  });

  it('50g pirinç doğru hesaplanır', () => {
    const result = calculateEntryNutrition(RICE, 50, 'g');
    expect(result.calories).toBe(65);
    expect(result.carbsG).toBe(14.4);
  });

  it('2 serving tavuk doğru hesaplanır', () => {
    const result = calculateEntryNutrition(CHICKEN, 2, 'serving');
    expect(result.calories).toBe(330);
    expect(result.fatG).toBe(7.2);
  });
});

describe('sumDayTotals', () => {
  const makeEntry = (overrides: Partial<NutritionEntry>): NutritionEntry => ({
    id: 'e1', userId: 'u1', foodId: null, entryDate: '2026-06-12',
    mealType: 'breakfast', amount: 1, unit: 'serving',
    calories: 0, carbsG: 0, proteinG: 0, fatG: 0,
    isQuickAdd: false, createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('boş liste için sıfır döner', () => {
    const result = sumDayTotals([]);
    expect(result.calories).toBe(0);
    expect(result.carbsG).toBe(0);
  });

  it('birden fazla entry toplamını doğru hesaplar', () => {
    const entries = [
      makeEntry({ calories: 165, carbsG: 0,    proteinG: 31, fatG: 3.6 }),
      makeEntry({ calories: 130, carbsG: 28.7, proteinG: 2.7, fatG: 0.3 }),
      makeEntry({ calories: 50,  carbsG: 5,    proteinG: 2,  fatG: 1   }),
    ];
    const result = sumDayTotals(entries);
    expect(result.calories).toBe(345);
    expect(result.carbsG).toBeCloseTo(33.7, 1);
    expect(result.proteinG).toBeCloseTo(35.7, 1);
    expect(result.fatG).toBeCloseTo(4.9, 1);
  });
});

describe('calculateMacroPercentages', () => {
  it('sıfır makroda sıfır yüzde döner', () => {
    const result = calculateMacroPercentages({ carbsG: 0, proteinG: 0, fatG: 0 });
    expect(result.carbsPct).toBe(0);
    expect(result.proteinPct).toBe(0);
    expect(result.fatPct).toBe(0);
  });

  it('yalnızca karbonhidrattan oluşan diyet', () => {
    const result = calculateMacroPercentages({ carbsG: 100, proteinG: 0, fatG: 0 });
    expect(result.carbsPct).toBe(100);
    expect(result.proteinPct).toBe(0);
    expect(result.fatPct).toBe(0);
  });

  it('dengeli makro dağılımı (50% karb, 25% protein, 25% yağ)', () => {
    // 200g karb = 800 kcal, 100g protein = 400 kcal, 44.4g yağ = ~400 kcal → total ~1600
    const result = calculateMacroPercentages({ carbsG: 200, proteinG: 100, fatG: 44.4 });
    expect(result.carbsPct).toBe(50);
    expect(result.proteinPct).toBe(25);
    expect(result.fatPct).toBe(25);
  });
});

describe('getRemainingCalories', () => {
  it('tüketilmeden önceki kalan = hedef', () => {
    expect(getRemainingCalories(0, 2000)).toBe(2000);
  });

  it('yarıya kadar tüketildiğinde 1000 kalır', () => {
    expect(getRemainingCalories(1000, 2000)).toBe(1000);
  });

  it('hedef aşıldığında negatif değer döner', () => {
    expect(getRemainingCalories(2500, 2000)).toBe(-500);
  });
});

describe('getProgressRatio', () => {
  it('0/2000 → 0', () => expect(getProgressRatio(0, 2000)).toBe(0));
  it('1000/2000 → 0.5', () => expect(getProgressRatio(1000, 2000)).toBe(0.5));
  it('2000/2000 → 1', () => expect(getProgressRatio(2000, 2000)).toBe(1));
  it('hedef aşıldığında 1\'de klamplanır', () => expect(getProgressRatio(3000, 2000)).toBe(1));
  it('negatif değer 0\'da klamplanır', () => expect(getProgressRatio(-100, 2000)).toBe(0));
  it('sıfır hedefle 0 döner', () => expect(getProgressRatio(500, 0)).toBe(0));
});
