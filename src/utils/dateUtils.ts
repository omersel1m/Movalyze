const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_LONG  = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// "2026-06-18" → Date (local midnight)
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date → "2026-06-18"
export function toDateString(date: Date): string {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Today → "2026-06-18"
export function todayString(): string {
  return toDateString(new Date());
}

// "18 Haz" short chip label
export function formatDayChip(date: Date): string {
  return `${date.getDate()} ${TR_MONTHS_SHORT[date.getMonth()]}`;
}

// "18 Haziran 2026" full label
export function formatDayFull(date: Date): string {
  return `${date.getDate()} ${TR_MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

// Returns the Monday of the calendar week containing `date`
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  // getDay(): 0=Sun, 1=Mon... adjust so Mon=0
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Monday + 6 = Sunday
export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// "10–16 Haz" chip label — same month
// "29 May–04 Haz" chip label — cross month
export function formatWeekChip(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startDay   = weekStart.getDate();
  const startMonth = weekStart.getMonth();
  const endDay     = weekEnd.getDate();
  const endMonth   = weekEnd.getMonth();

  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${TR_MONTHS_SHORT[endMonth]}`;
  }
  return `${startDay} ${TR_MONTHS_SHORT[startMonth]}–${endDay} ${TR_MONTHS_SHORT[endMonth]}`;
}

// "10 Haziran 2026 – 16 Haziran 2026" full modal label
export function formatWeekFull(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  return `${formatDayFull(weekStart)} – ${formatDayFull(weekEnd)}`;
}

// Returns array of the last `count` calendar week starts (Mondays), newest first
export function getRecentWeeks(count: number): Date[] {
  const thisMonday = getWeekStart(new Date());
  const weeks: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d);
  }
  return weeks;
}

// Returns array of last `count` days (today first)
export function getRecentDays(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d;
  });
}

// ISO start/end strings for a date (for Supabase range queries)
export function dayRangeISO(date: Date): { start: string; end: string } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = d.toISOString();
  d.setHours(23, 59, 59, 999);
  return { start, end: d.toISOString() };
}

// ISO start/end strings for a calendar week
export function weekRangeISO(weekStart: Date): { start: string; end: string } {
  return {
    start: new Date(weekStart).toISOString(),
    end:   getWeekEnd(weekStart).toISOString(),
  };
}

// Are two dates the same calendar day?
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

// Are two dates in the same calendar week (Mon–Sun)?
export function isSameWeek(a: Date, b: Date): boolean {
  return toDateString(getWeekStart(a)) === toDateString(getWeekStart(b));
}
