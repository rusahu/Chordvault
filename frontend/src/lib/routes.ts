import type { Destination } from './songEditRoute';

const LOCAL_PREFIX = 'local_';
const SONG_RE = /^#song\/(\d+)$/;
const SETLIST_RE = /^#setlist\/(local_\w+|\d+)$/;
const PLAY_RE = /^#setlist\/(local_\w+|\d+)\/play(?:\/(\d+))?$/;
const HASHLESS_VIEWS = ['browse', 'my-songs', 'setlists', 'admin', 'settings', 'auth', 'about', 'public-setlists'];

export const isLocalSetlistId = (id: number | string): id is string => typeof id === 'string' && id.startsWith(LOCAL_PREFIX);
export const parseSetlistId = (id: string): number | string => (isLocalSetlistId(id) ? id : parseInt(id));
export const newLocalSetlistId = () => `${LOCAL_PREFIX}${Date.now()}`;

export const songHash = (id: number | string) => `#song/${id}`;
export const setlistHash = (id: number | string) => `#setlist/${id}`;
export const setlistPlayHash = (id: number | string, index = 0) => `${setlistHash(id)}/play${index > 0 ? `/${index}` : ''}`;

export function setlistPlayParams(id: number | string, index = 0): Record<string, string> {
  return { id: String(id), ...(isLocalSetlistId(id) ? { local: '1' } : {}), ...(index > 0 ? { index: String(index) } : {}) };
}

export function parsePlayHash(hash: string): { id: string; index: number } | null {
  const match = hash.match(PLAY_RE);
  return match ? { id: match[1], index: match[2] ? parseInt(match[2]) : 0 } : null;
}

export function parseHash(hash: string): Destination {
  const song = hash.match(SONG_RE);
  if (song) return { view: 'song-view', params: { id: song[1] } };
  const play = parsePlayHash(hash);
  if (play) return { view: 'setlist-play', params: setlistPlayParams(play.id, play.index) };
  const setlist = hash.match(SETLIST_RE);
  if (setlist) return { view: 'setlist-edit', params: { id: setlist[1] } };
  return { view: 'browse', params: {} };
}

/** The hash a navigation writes: a deep link, '' to clear it, or null to leave it alone. */
export function routeHash(view: string, params: Record<string, string>): string | null {
  if (view === 'song-view' && params.id) return songHash(params.id);
  if (view === 'setlist-edit' && params.id) return setlistHash(params.id);
  if (view === 'setlist-play' && params.id) return setlistPlayHash(params.id, Number(params.index) || 0);
  return HASHLESS_VIEWS.includes(view) ? '' : null;
}

/** Changes the hash without a hashchange event or a history entry. */
export const replaceHash = (hash: string) => history.replaceState(null, '', location.pathname + location.search + hash);
