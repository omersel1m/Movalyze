import { useState, useCallback, useEffect } from 'react';
import { nutritionService } from '../../../services/nutrition.service';
import { NutritionGoals } from '../types/nutrition.types';

const DEFAULT_GOALS: NutritionGoals = {
  dailyCalories: 2000,
  carbsG: 250,
  proteinG: 100,
  fatG: 65,
  waterMl: 2500,
};

export function useNutritionGoals() {
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await nutritionService.getGoals();
      setGoals(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hedefler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveGoals = useCallback(async (updated: Partial<NutritionGoals>) => {
    setSaving(true);
    setError(null);
    try {
      await nutritionService.updateGoals(updated);
      setGoals(prev => ({ ...prev, ...updated }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hedefler kaydedilemedi.');
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { goals, loading, saving, error, saveGoals, reload: load };
}
