import { MealType } from '../types/nutrition.types';

export interface MealCategory {
  type: MealType;
  label: string;
  icon: string;
}

export const MEAL_CATEGORIES: MealCategory[] = [
  { type: 'breakfast', label: 'Kahvaltı',       icon: 'Sunrise'  },
  { type: 'lunch',     label: 'Öğle Yemeği',    icon: 'Sun'      },
  { type: 'dinner',    label: 'Akşam Yemeği',   icon: 'Moon'     },
  { type: 'snack',     label: 'Atıştırmalık',   icon: 'Cookie'   },
];
