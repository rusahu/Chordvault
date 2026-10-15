import type { SongVersion } from '../types';

/** SQLite CURRENT_TIMESTAMP is UTC without a zone; read it as UTC. */
export function parseDbTime(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
}

export const formatDbDate = (s: string | null | undefined) => (s ? parseDbTime(s).toLocaleDateString() : '');

export const formatSongCount = (count: number, t: (key: string) => string) =>
  `${count} ${count !== 1 ? t('admin.songPlural') : t('admin.song')}`;

export const versionLabel = (version: Pick<SongVersion, 'username' | 'youtube_url'>, index: number) =>
  `${index + 1} (@${version.username}) ${version.youtube_url ? '▶' : ''}`;
