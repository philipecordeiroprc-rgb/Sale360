/**
 * Timezone-independent date helpers for America/Sao_Paulo (BRT, UTC-3).
 *
 * These functions construct Date objects relative to BRT regardless of the
 * server's local timezone. This prevents date-range queries from drifting
 * when the Node.js process TZ is not set to America/Sao_Paulo.
 */

const TZ_OFFSET = '-03:00';

/** Parse a "YYYY-MM-DD" string as midnight BRT (00:00:00.000 -03:00) */
export function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${TZ_OFFSET}`);
}

/** Parse a "YYYY-MM-DD" string as end-of-day BRT (23:59:59.999 -03:00) */
export function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${TZ_OFFSET}`);
}

/** Pad a number to 2 digits (e.g. 3 → "03") */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Return [year, month, day] for today in BRT */
export function todayBRT(): { year: number; month: number; day: number } {
  const now = new Date();
  // Format in BRT via Intl (works regardless of process TZ)
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  let year = 0, month = 0, day = 0;
  for (const p of parts) {
    if (p.type === 'year') year = Number(p.value);
    if (p.type === 'month') month = Number(p.value);
    if (p.type === 'day') day = Number(p.value);
  }
  return { year, month, day };
}

/** Build start/end Date for a given month (1-indexed) in BRT */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const startStr = `${year}-${pad(month)}-01`;
  // last day of month: use Date.UTC to avoid local TZ, then back to BRT
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endStr = `${year}-${pad(month)}-${pad(lastDay)}`;
  return {
    start: new Date(`${startStr}T00:00:00${TZ_OFFSET}`),
    end: new Date(`${endStr}T23:59:59.999${TZ_OFFSET}`),
  };
}
