import { RepLogEntry, WorkoutSessionSummary } from './engine.types';

// Shared, exercise-agnostic session summarizer. Each analyzer passes its own
// warning→error-code map and label map; everything else is identical.

export const PERFECT_FORM = 'Mükemmel form!';

export function isPerfectRep(warnings: string[]): boolean {
  return warnings.length === 0 || (warnings.length === 1 && warnings[0] === PERFECT_FORM);
}

export function summarizeSession(
  fullRepLog: RepLogEntry[],
  warningToErrorCode: Record<string, string>,
  errorCodeLabels: Record<string, string>,
): WorkoutSessionSummary {
  const totalReps   = fullRepLog.length;
  const leftReps    = fullRepLog.filter(r => r.arm === 'left').length;
  const rightReps   = fullRepLog.filter(r => r.arm === 'right').length;
  const correctReps = fullRepLog.filter(r => isPerfectRep(r.warnings)).length;

  const scores = fullRepLog.map(r => r.score);
  const avgFormScore =
    scores.length > 0
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null;
  const bestFormScore  = scores.length > 0 ? Math.max(...scores) : null;
  const worstFormScore = scores.length > 0 ? Math.min(...scores) : null;

  const errorCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();
  for (const rep of fullRepLog) {
    for (const w of rep.warnings) {
      if (w === PERFECT_FORM) continue;
      const code = warningToErrorCode[w];
      if (!code) continue;
      errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
      const label = errorCodeLabels[code] ?? code;
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }

  const errors = [...errorCounts.entries()]
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count);

  const topWarnings = [...labelCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totalReps, leftReps, rightReps, correctReps,
    avgFormScore, bestFormScore, worstFormScore,
    repLog: fullRepLog, errors, topWarnings,
  };
}
