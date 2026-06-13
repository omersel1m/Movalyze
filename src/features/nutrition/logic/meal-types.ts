import { MealType } from '../types/nutrition.types';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Kahvaltı',
  lunch:     'Öğle Yemeği',
  dinner:    'Akşam Yemeği',
  snack:     'Atıştırmalık',
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
