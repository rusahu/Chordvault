import { songEditReturn, type Destination } from './songEditRoute';

const LOCAL_PREFIX = 'local_';
const SETLIST_ID = 'local_\\w+|\\d+';
const SONG_RE = /^#song\/(\d+)(?:\/(edit|correct))?$/;
const SETLIST_RE = new RegExp(`^#setlist\\/(${SETLIST_ID})$`);
const PLAY_RE = new RegExp(`^#setlist\\/(${SETLIST_ID})\\/play(?:\\/(\\d+))?$`);
const NEW_SONG = '#song/new';
const EDIT_RETURN_KEYS = ['back', 'setlist', 'index'];

/** Views whose address is just their name, e.g. `#settings`. Browse lives at the bare root. */
export const PAGE_VIEWS: readonly string[] = ['my-songs', 'setlists', 'public-setlists', 'settings', 'admin', 'about', 'auth'];
/** Views that are refused while writes are locked (offline), whether reached by the nav or by address. */
export const WRITE_LOCKED_VIEWS: readonly string[] = ['song-edit', 'correction', 'admin', 'auth'];

export type Navigate = (view: string, params?: Record<string, string>, options?: { replace?: boolean }) => void;

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
  const [path, query = ''] = hash.split('?');
  if (path === NEW_SONG) return { view: 'song-edit', params: {} };
  const song = path.match(SONG_RE);
  if (song) {
    if (song[2] === 'edit') return { view: 'song-edit', params: { id: song[1], ...editReturnParams(new URLSearchParams(query)) } };
    return { view: song[2] === 'correct' ? 'correction' : 'song-view', params: { id: song[1] } };
  }
  const play = parsePlayHash(path);
  if (play) return { view: 'setlist-play', params: setlistPlayParams(play.id, play.index) };
  const setlist = path.match(SETLIST_RE);
  if (setlist) return { view: 'setlist-edit', params: { id: setlist[1] } };
  const page = path.slice(1);
  return PAGE_VIEWS.includes(page) ? { view: page, params: {} } : { view: 'browse', params: {} };
}

// Keeps the editor's way back to a setlist only when it is well formed, so a hand-typed address cannot load /api/setlists/NaN.
function editReturnParams(query: URLSearchParams): Record<string, string> {
  const params = Object.fromEntries(EDIT_RETURN_KEYS.flatMap(key => (query.get(key) ? [[key, query.get(key)!]] : [])));
  if (!songEditReturn(params) || !new RegExp(`^(${SETLIST_ID})$`).test(params.setlist)) return {};
  if (params.index && !/^\d+$/.test(params.index)) delete params.index;
  return params;
}

/** The hash a navigation writes: '' for Browse, the view's address, or null for an unknown view or missing id. */
export function routeHash(view: string, params: Record<string, string>): string | null {
  if (view === 'browse') return '';
  if (PAGE_VIEWS.includes(view)) return `#${view}`;
  if (view === 'song-edit') {
    if (!params.id) return NEW_SONG;
    const back = new URLSearchParams(EDIT_RETURN_KEYS.flatMap(key => (params[key] ? [[key, params[key]]] : []))).toString();
    return `${songHash(params.id)}/edit${back ? `?${back}` : ''}`;
  }
  if (!params.id) return null;
  if (view === 'song-view') return songHash(params.id);
  if (view === 'correction') return `${songHash(params.id)}/correct`;
  if (view === 'setlist-edit') return setlistHash(params.id);
  if (view === 'setlist-play') return setlistPlayHash(params.id, Number(params.index) || 0);
  return null;
}

/** Changes the hash without a hashchange event or a history entry. */
export const replaceHash = (hash: string) => history.replaceState(null, '', location.pathname + location.search + hash);
