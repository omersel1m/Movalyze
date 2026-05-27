import { statsRepository } from '../repositories/stats.repository';
import { DailyStats } from '../database/models/types';

export interface AccuracyEntry {
  slug: string;
  avg_accuracy: number;
  sessions: number;
  reps: number;
}

export const statsService = {
  todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  },

  async getDailyStats(userId: string, date?: string): Promise<DailyStats | null> {
    const targetDate = date ?? statsService.todayDateString();
    return statsRepository.getDailyStatsForDate(userId, targetDate);
  },

  // categorySlug verilmezse tüm egzersizlerin doğruluk listesini döner.
  // categorySlug verilirse sadece o kategoriye ait egzersizleri filtreler.
  filterAccuracyByCategory(
    accuracyByExercise: DailyStats['accuracy_by_exercise'],
    exerciseCategoryMap: Array<{ exerciseSlug: string; categorySlug: string }>,
    categorySlug: string | null,
  ): AccuracyEntry[] {
    const allowedSlugs = categorySlug
      ? new Set(
          exerciseCategoryMap
            .filter(e => e.categorySlug === categorySlug)
            .map(e => e.exerciseSlug),
        )
      : null;

    return Object.entries(accuracyByExercise)
      .filter(([slug]) => !allowedSlugs || allowedSlugs.has(slug))
      .map(([slug, val]) => ({
        slug,
        avg_accuracy: val.avg_accuracy,
        sessions: val.sessions,
        reps: val.reps,
      }))
      .sort((a, b) => b.avg_accuracy - a.avg_accuracy);
  },

  accuracyColor(pct: number): string {
    if (pct >= 80) return '#268479';
    if (pct >= 60) return '#F97316';
    return '#E53E3E';
  },
};
