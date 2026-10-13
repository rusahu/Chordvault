import { songEditFromSetlist, songEditReturn } from '../songEditRoute';

describe('songEditRoute', () => {
  it('round-trips a playback position', () => {
    expect(songEditReturn(songEditFromSetlist(9, 'setlist-play', 'local_abc', 3)))
      .toEqual({ view: 'setlist-play', params: { id: 'local_abc', index: '3' } });
  });

  it('returns to the setlist page without an index', () => {
    expect(songEditReturn(songEditFromSetlist(9, 'setlist-edit', 12)))
      .toEqual({ view: 'setlist-edit', params: { id: '12' } });
  });

  it('ignores a plain song edit or an unknown destination', () => {
    expect(songEditReturn({ id: '9' })).toBeUndefined();
    expect(songEditReturn({ id: '9', back: 'admin', setlist: '1' })).toBeUndefined();
  });
});
