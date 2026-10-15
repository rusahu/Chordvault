import {
  isLocalSetlistId, parseSetlistId, newLocalSetlistId, songHash, setlistHash, setlistPlayHash,
  setlistPlayParams, parsePlayHash, parseHash, routeHash, replaceHash,
} from '../routes';

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

it('gives deep-linked views a hash, clears it for list views and leaves the rest alone', () => {
  expect(routeHash('song-view', { id: '4' })).toBe('#song/4');
  expect(routeHash('setlist-edit', { id: 'local_1' })).toBe('#setlist/local_1');
  expect(routeHash('setlist-play', { id: '2', index: '0' })).toBe('#setlist/2/play');
  expect(routeHash('setlist-play', { id: '2', index: '3' })).toBe('#setlist/2/play/3');
  for (const view of ['browse', 'my-songs', 'setlists', 'admin', 'settings', 'auth', 'about', 'public-setlists']) expect(routeHash(view, {})).toBe('');
  expect(routeHash('song-edit', { id: '4' })).toBeNull();
  expect(routeHash('song-view', {})).toBeNull();
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
