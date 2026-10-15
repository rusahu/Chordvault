import { describe, it, expect } from 'vitest';
import { parseDbTime, formatDbDate } from '../format';

describe('database timestamps', () => {
  it('reads SQLite CURRENT_TIMESTAMP as UTC', () => {
    expect(parseDbTime('2026-10-15 23:30:00').toISOString()).toBe('2026-10-15T23:30:00.000Z');
    expect(parseDbTime('2026-10-15T23:30:00Z').toISOString()).toBe('2026-10-15T23:30:00.000Z');
    expect(parseDbTime('2026-10-15T23:30:00+08:00').toISOString()).toBe('2026-10-15T15:30:00.000Z');
  });

  it('formats as a local date and tolerates empty', () => {
    expect(formatDbDate('2026-10-15 23:30:00')).toBe(new Date(Date.UTC(2026, 9, 15, 23, 30)).toLocaleDateString());
    expect(formatDbDate(null)).toBe('');
    expect(formatDbDate(undefined)).toBe('');
  });

  it('shows a late UTC time as the next day in UTC+8', () => {
    expect(parseDbTime('2026-10-15 23:30:00').toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })).toBe('2026-10-16');
  });
});
