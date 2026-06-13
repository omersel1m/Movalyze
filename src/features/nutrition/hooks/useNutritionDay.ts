import { useState, useCallback, useEffect } from 'react';
import { nutritionService } from '../../../services/nutrition.service';
import { DayNutrition, MealType, NutritionEntry } from '../types/nutrition.types';

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function useNutritionDay(initialDate?: string) {
  const [date, setDate] = useState(initialDate ?? todayString());
  const [data, setData] = useState<DayNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await nutritionService.getDayNutrition(targetDate);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const refresh = useCallback(() => load(date), [date, load]);

  const goToPrevDay = useCallback(() => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  }, [date]);

  const goToNextDay = useCallback(() => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  }, [date]);

  const goToToday = useCallback(() => {
    setDate(todayString());
  }, []);

  const isToday = date === todayString();

  const deleteFoodEntry = useCallback(async (entryId: string) => {
    try {
      await nutritionService.deleteFoodEntry(entryId);
      await load(date);
    } catch {
      // silently ignore — entry stays visible until next load
    }
  }, [date, load]);

  const addWater = useCallback(async (amountMl: number) => {
    // Optimistic update for instant visual feedback
    setData(prev =>
      prev ? { ...prev, waterMl: prev.waterMl + amountMl } : prev,
    );
    try {
      await nutritionService.addWater(date, amountMl);
    } catch {
      // Revert on failure
      setData(prev =>
        prev ? { ...prev, waterMl: Math.max(0, prev.waterMl - amountMl) } : prev,
      );
    }
  }, [date]);

  const removeWater = useCallback(async (amountMl: number) => {
    setData(prev =>
      prev ? { ...prev, waterMl: Math.max(0, prev.waterMl - amountMl) } : prev,
    );
    try {
      await nutritionService.removeWater(date, amountMl);
    } catch {
      setData(prev =>
        prev ? { ...prev, waterMl: prev.waterMl + amountMl } : prev,
      );
    }
  }, [date]);

  const addQuickCalories = useCallback(async (
    mealType: MealType,
    kcal: number,
    label?: string,
  ) => {
    try {
      await nutritionService.addQuickCalories(date, mealType, kcal, label);
      await load(date);
    } catch {
      // silently ignore
    }
  }, [date, load]);

  const getEntriesForMeal = useCallback((meal: MealType): NutritionEntry[] => {
    return data?.meals[meal] ?? [];
  }, [data]);

  return {
    date,
    data,
    loading,
    error,
    refresh,
    goToPrevDay,
    goToNextDay,
    goToToday,
    isToday,
    deleteFoodEntry,
    addWater,
    removeWater,
    addQuickCalories,
    getEntriesForMeal,
  };
}
