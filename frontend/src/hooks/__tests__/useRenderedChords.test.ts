import { renderHook } from '@testing-library/react';
import { useRenderedChords } from '../useRenderedChords';

it('renders the song in the target key with its played key', () => {
  const { result } = renderHook(() => useRenderedChords('{key: C}\n[C]Amazing [G]grace', 'D', false));
  expect(result.current).toMatchObject({ transpose: 2, currentKey: 'D', hasKey: true });
  expect(result.current.renderedHtml).toContain('>D<');
  expect(result.current.renderedHtml).toContain('>A<');
});

it('plays as written without a target key and reports a missing key directive', () => {
  const { result } = renderHook(() => useRenderedChords('[G]Amazing grace', null, false));
  expect(result.current).toMatchObject({ transpose: 0, currentKey: 'G', hasKey: false });
});
