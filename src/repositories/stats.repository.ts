import { supabase } from '../config/supabaseClient';
import { DailyStats } from '../database/models/types';

export const statsRepository = {
  async getDailyStatsForDate(userId: string, date: string): Promise<DailyStats | null> {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('stat_date', date)
      .single();

    if (error) return null;
    return data as DailyStats;
  },

  // exercises tablosundan tüm aktif egzersizleri category slug'ı ile birlikte çeker.
  // Dönen yapı: [{ exerciseSlug: string, categorySlug: string }]
  async getExercisesWithCategory(): Promise<Array<{ exerciseSlug: string; categorySlug: string }>> {
    const { data, error } = await supabase
      .from('exercises')
      .select('slug, exercise_categories!inner(slug)')
      .eq('is_active', true);

    if (error || !data) return [];

    return data.map((row: any) => ({
      exerciseSlug: row.slug,
      categorySlug: row.exercise_categories.slug,
    }));
  },
};
