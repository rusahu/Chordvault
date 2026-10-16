import {
  isLocalSetlistId, parseSetlistId, newLocalSetlistId, songHash, setlistHash, setlistPlayHash,
  setlistPlayParams, parsePlayHash, parseHash, routeHash, replaceHash,
} from '../routes';
import type { Destination } from '../songEditRoute';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

afterEach(() => history.replaceState(null, '', '/'));

it('tells local setlist ids from server ids', () => {
  expect(isLocalSetlistId('local_17')).toBe(true);
  expect(isLocalSetlistId('17')).toBe(false);
  expect(isLocalSetlistId(17)).toBe(false);
  expect(parseSetlistId('local_17')).toBe('local_17');
  expect(parseSetlistId('17')).toBe(17);
  expect(newLocalSetlistId()).toMatch(/^local_\d+$/);
});

it('builds hashes and never writes a zero play index', () => {
  expect(songHash(4)).toBe('#song/4');
  expect(setlistHash('local_1')).toBe('#setlist/local_1');
  expect(setlistPlayHash(2)).toBe('#setlist/2/play');
  expect(setlistPlayHash(2, 0)).toBe('#setlist/2/play');
  expect(setlistPlayHash(2, 3)).toBe('#setlist/2/play/3');
});

it('marks local play params and omits index 0', () => {
  expect(setlistPlayParams('local_1', 2)).toEqual({ id: 'local_1', local: '1', index: '2' });
  expect(setlistPlayParams(5)).toEqual({ id: '5' });
  expect(setlistPlayParams(5, 0)).toEqual({ id: '5' });
});

it('parses every deep link App supports', () => {
  expect(parseHash('')).toEqual({ view: 'browse', params: {} });
  expect(parseHash('#song/42')).toEqual({ view: 'song-view', params: { id: '42' } });
  expect(parseHash('#setlist/42')).toEqual({ view: 'setlist-edit', params: { id: '42' } });
  expect(parseHash('#setlist/local_9')).toEqual({ view: 'setlist-edit', params: { id: 'local_9' } });
  expect(parseHash('#setlist/local_9/play/3')).toEqual({ view: 'setlist-play', params: { id: 'local_9', local: '1', index: '3' } });
  expect(parseHash('#setlist/42/play')).toEqual({ view: 'setlist-play', params: { id: '42' } });
  expect(parseHash('#nope')).toEqual({ view: 'browse', params: {} });
  expect(parsePlayHash('#setlist/42/play/2')).toEqual({ id: '42', index: 2 });
  expect(parsePlayHash('#setlist/42')).toBeNull();
});

const EVERY_VIEW: Destination[] = [
  { view: 'browse', params: {} },
  ...['my-songs', 'setlists', 'public-setlists', 'settings', 'admin', 'about', 'auth'].map(view => ({ view, params: {} })),
  { view: 'song-view', params: { id: '4' } },
  { view: 'song-edit', params: {} },
  { view: 'song-edit', params: { id: '4' } },
  { view: 'song-edit', params: { id: '4', back: 'setlist-play', setlist: 'local_9', index: '2' } },
  { view: 'song-edit', params: { id: '4', back: 'setlist-edit', setlist: '7' } },
  { view: 'correction', params: { id: '4' } },
  { view: 'setlist-edit', params: { id: '7' } },
  { view: 'setlist-play', params: { id: '7', index: '3' } },
  { view: 'setlist-play', params: { id: 'local_9', local: '1' } },
];

it('gives every view an address that reads back to the same view', () => {
  for (const dest of EVERY_VIEW) expect(parseHash(routeHash(dest.view, dest.params) ?? '#unrouted')).toEqual(dest);
  expect(routeHash('browse', {})).toBe('');
  expect(routeHash('settings', {})).toBe('#settings');
  expect(routeHash('song-edit', {})).toBe('#song/new');
  expect(routeHash('correction', { id: '4' })).toBe('#song/4/correct');
  expect(routeHash('song-edit', { id: '4', back: 'setlist-edit', setlist: '7' })).toBe('#song/4/edit?back=setlist-edit&setlist=7');
});

it('has an address for every view App renders', () => {
  const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
  const views = [...app.matchAll(/case '([a-z-]+)':/g)].map(m => m[1]);
  expect(views.length).toBeGreaterThan(10);
  for (const view of views) expect(EVERY_VIEW.some(dest => dest.view === view), view).toBe(true);
});

it('falls back safely for unknown or malformed addresses', () => {
  for (const hash of ['#nope', '#song/abc', '#song/abc/edit', '#settings/x', '#setlist/abc']) expect(parseHash(hash)).toEqual({ view: 'browse', params: {} });
  expect(parseHash('#song/4/edit?back=evil&setlist=7')).toEqual({ view: 'song-edit', params: { id: '4' } });
  expect(parseHash('#song/4/edit?back=setlist-play&setlist=abc')).toEqual({ view: 'song-edit', params: { id: '4' } });
  expect(parseHash('#song/4/edit?back=setlist-play&setlist=7&index=x')).toEqual({ view: 'song-edit', params: { id: '4', back: 'setlist-play', setlist: '7' } });
});

it('replaces the hash without adding a history entry', () => {
  history.replaceState(null, '', '/app?x=1#song/1');
  const entries = history.length;
  replaceHash('#setlist/2/play');
  expect(location.pathname + location.search + location.hash).toBe('/app?x=1#setlist/2/play');
  replaceHash('');
  expect(location.hash).toBe('');
  expect(history.length).toBe(entries);
});
