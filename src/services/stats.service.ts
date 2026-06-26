import { statsRepository, SessionRow, ErrorRow } from '../repositories/stats.repository';
import { DailyStats } from '../database/models/types';
import { dayRangeISO, weekRangeISO } from '../utils/dateUtils';

// ── Public types ──────────────────────────────────────────────────────────────

export interface AccuracyEntry {
  slug: string;
  avg_accuracy: number;
  sessions: number;
  reps: number;
}

export interface CommonExercise {
  name: string;
  slug: string;
  totalReps: number;
  sessions: number;
}

export interface FormImprovement {
  currentAvg: number | null;
  previousAvg: number | null;
  changePct: number | null;  // positive = improved
}

export interface ErrorBucket {
  errorCode: string;
  totalCount: number;
}

export interface MostFrequentError {
  errorCode: string;
  feedback: string | null;
  exerciseName: string;
  exerciseSlug: string;
  totalCount: number;
}

export interface PeriodStats {
  mostCommon: CommonExercise[];
  formImprovement: FormImprovement;
  errorBreakdown: ErrorBucket[];
  hasData: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const statsService = {
  todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  },

  // Legacy daily_stats lookup
  async getDailyStats(userId: string, date?: string): Promise<DailyStats | null> {
    const targetDate = date ?? statsService.todayDateString();
    return statsRepository.getDailyStatsForDate(userId, targetDate);
  },

  async getMostFrequentError(userId: string): Promise<MostFrequentError | null> {
    const errors = await statsRepository.getErrorDetails(userId);
    if (errors.length === 0) return null;

    const grouped = new Map<string, MostFrequentError>();
    for (const error of errors) {
      const key = `${error.exercise_slug}:${error.error_code}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.totalCount += error.occurrence_count;
        if (!existing.feedback && error.error_description) {
          existing.feedback = error.error_description;
        }
      } else {
        grouped.set(key, {
          errorCode: error.error_code,
          feedback: error.error_description,
          exerciseName: error.exercise_name,
          exerciseSlug: error.exercise_slug,
          totalCount: error.occurrence_count,
        });
      }
    }

    return [...grouped.values()].sort((a, b) => b.totalCount - a.totalCount)[0] ?? null;
  },

  // ── Daily period stats ──────────────────────────────────────────
  async getDayStats(
    userId: string,
    date: Date,
    categorySlug: string | null,
  ): Promise<PeriodStats> {
    const { start, end } = dayRangeISO(date);
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const { start: prevStart, end: prevEnd } = dayRangeISO(prevDate);

    const [sessions, prevSessions, errors] = await Promise.all([
      statsRepository.getSessionsForRange(userId, start, end),
      statsRepository.getSessionsForRange(userId, prevStart, prevEnd),
      statsRepository.getErrorsForRange(userId, start, end),
    ]);

    return statsService._buildPeriodStats(sessions, prevSessions, errors, categorySlug);
  },

  // ── Weekly period stats ─────────────────────────────────────────
  async getWeekStats(
    userId: string,
    weekStart: Date,
    categorySlug: string | null,
  ): Promise<PeriodStats> {
    const { start, end } = weekRangeISO(weekStart);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const { start: prevStart, end: prevEnd } = weekRangeISO(prevWeekStart);

    const [sessions, prevSessions, errors] = await Promise.all([
      statsRepository.getSessionsForRange(userId, start, end),
      statsRepository.getSessionsForRange(userId, prevStart, prevEnd),
      statsRepository.getErrorsForRange(userId, start, end),
    ]);

    return statsService._buildPeriodStats(sessions, prevSessions, errors, categorySlug);
  },

  // ── Internal aggregation ────────────────────────────────────────
  _buildPeriodStats(
    sessions: SessionRow[],
    prevSessions: SessionRow[],
    errors: ErrorRow[],
    categorySlug: string | null,
  ): PeriodStats {
    const filtered     = categorySlug ? sessions.filter(s => s.category_slug === categorySlug) : sessions;
    const prevFiltered = categorySlug ? prevSessions.filter(s => s.category_slug === categorySlug) : prevSessions;
    const errFiltered  = categorySlug ? errors.filter(e => e.category_slug === categorySlug) : errors;

    if (filtered.length === 0) {
      return {
        mostCommon: [],
        formImprovement: { currentAvg: null, previousAvg: null, changePct: null },
        errorBreakdown: [],
        hasData: false,
      };
    }

    // Most common exercises by total reps
    const repByExercise = new Map<string, { name: string; slug: string; reps: number; sessions: number }>();
    for (const s of filtered) {
      const existing = repByExercise.get(s.exercise_id);
      if (existing) {
        existing.reps     += s.total_reps;
        existing.sessions += 1;
      } else {
        repByExercise.set(s.exercise_id, {
          name: s.exercise_name, slug: s.exercise_slug,
          reps: s.total_reps, sessions: 1,
        });
      }
    }
    const mostCommon: CommonExercise[] = [...repByExercise.values()]
      .map(v => ({ name: v.name, slug: v.slug, totalReps: v.reps, sessions: v.sessions }))
      .sort((a, b) => b.totalReps - a.totalReps)
      .slice(0, 5);

    // Form improvement
    const avg = (rows: SessionRow[]) => {
      const valid = rows.filter(r => r.avg_accuracy_pct !== null);
      if (valid.length === 0) return null;
      return valid.reduce((s, r) => s + r.avg_accuracy_pct!, 0) / valid.length;
    };
    const currentAvg  = avg(filtered);
    const previousAvg = avg(prevFiltered);
    const changePct =
      currentAvg !== null && previousAvg !== null && previousAvg > 0
        ? ((currentAvg - previousAvg) / previousAvg) * 100
        : null;

    // Error breakdown
    const errMap = new Map<string, number>();
    for (const e of errFiltered) {
      errMap.set(e.error_code, (errMap.get(e.error_code) ?? 0) + e.occurrence_count);
    }
    const errorBreakdown: ErrorBucket[] = [...errMap.entries()]
      .map(([errorCode, totalCount]) => ({ errorCode, totalCount }))
      .sort((a, b) => b.totalCount - a.totalCount);

    return {
      mostCommon,
      formImprovement: { currentAvg, previousAvg, changePct },
      errorBreakdown,
      hasData: true,
    };
  },

  // Legacy category filter helper (Correct Repetition Rate card)
  filterAccuracyByCategory(
    accuracyByExercise: DailyStats['accuracy_by_exercise'],
    exerciseCategoryMap: Array<{ exerciseSlug: string; categorySlug: string }>,
    categorySlug: string | null,
  ): AccuracyEntry[] {
    const allowedSlugs = categorySlug
      ? new Set(exerciseCategoryMap.filter(e => e.categorySlug === categorySlug).map(e => e.exerciseSlug))
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

  changeColor(pct: number | null): string {
    if (pct === null) return '#8A8A8A';
    return pct >= 0 ? '#268479' : '#E53E3E';
  },

  formatChange(pct: number | null): string {
    if (pct === null) return '—';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  },
};
