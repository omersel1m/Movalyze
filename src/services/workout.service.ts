import { supabase } from '../config/supabaseClient';
import { Exercise, ExerciseCategory } from '../database/models/types';

// Kategori slug → renk haritası
export const CATEGORY_COLORS: Record<string, string> = {
  fitness: '#268479',
  therapy: '#AEBC2E',
  pilates: '#CB8510',
};

export const workoutService = {
  async getCategories(): Promise<ExerciseCategory[]> {
    const { data, error } = await supabase
      .from('exercise_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getExercisesByCategory(categoryId: string): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
