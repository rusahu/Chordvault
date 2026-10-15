import { describe, it, expect } from 'vitest';
import { parseDbTime, formatDbDate, formatSongCount, versionLabel } from '../format';

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

describe('list labels', () => {
  const t = (key: string) => ({ 'admin.song': 'song', 'admin.songPlural': 'songs' }[key] ?? key);

  it('counts songs with the singular only for one', () => {
    expect([0, 1, 2].map(n => formatSongCount(n, t))).toEqual(['0 songs', '1 song', '2 songs']);
  });

  it('labels a version by position, owner and video, as the selects show it', () => {
    expect(versionLabel({ username: 'amy', youtube_url: 'https://youtu.be/x' }, 0)).toBe('1 (@amy) ▶');
    expect(versionLabel({ username: 'bo', youtube_url: null }, 1)).toBe('2 (@bo) ');
  });
});
