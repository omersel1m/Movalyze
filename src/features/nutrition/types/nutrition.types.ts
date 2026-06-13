export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: 'g' | 'ml' | 'piece';
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isUserCreated: boolean;
}

export interface NutritionEntry {
  id: string;
  userId: string;
  foodId: string | null;
  foodName?: string;
  entryDate: string;
  mealType: MealType;
  amount: number;
  unit: string;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  isQuickAdd: boolean;
  quickAddLabel?: string;
  createdAt: string;
}

export interface NutritionGoals {
  dailyCalories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  waterMl: number;
}

export interface DayNutrition {
  date: string;
  totals: { calories: number; carbsG: number; proteinG: number; fatG: number };
  meals: Record<MealType, NutritionEntry[]>;
  waterMl: number;
  goals: NutritionGoals;
}

export interface NutritionValues {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface AddEntryInput {
  food: Food;
  entryDate: string;
  mealType: MealType;
  amount: number;
  unit: string;
}

export interface CustomFoodInput {
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: 'g' | 'ml' | 'piece';
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}
