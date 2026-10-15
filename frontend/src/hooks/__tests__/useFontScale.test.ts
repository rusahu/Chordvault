import { act, renderHook } from '@testing-library/react';
import { useFontScale } from '../useFontScale';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('keeps working when browser storage is blocked', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  const { result } = renderHook(() => useFontScale());
  expect(result.current.fontSize).toBe(0);
  act(() => result.current.changeFontSize(1));
  expect(result.current.fontSize).toBe(1);
});

it('reads, clamps and stores the size as a plain number (characterization)', () => {
  localStorage.setItem('cv_fontsize', '2');
  const { result } = renderHook(() => useFontScale());
  expect(result.current.fontSize).toBe(2);
  act(() => result.current.changeFontSize(10));
  expect(result.current.fontSize).toBe(5);
  expect(localStorage.getItem('cv_fontsize')).toBe('5');
  act(() => result.current.setFontSizeTo(-9));
  expect(localStorage.getItem('cv_fontsize')).toBe('-3');
  act(() => result.current.resetFontSize());
  expect(localStorage.getItem('cv_fontsize')).toBe('0');
});

it('treats a corrupt stored size as 0 (characterization)', () => {
  localStorage.setItem('cv_fontsize', 'big');
  expect(renderHook(() => useFontScale()).result.current.fontSize).toBe(0);
});

it('writes the size on mount, creating a missing key and rewriting a corrupt one (accepted change)', () => {
  renderHook(() => useFontScale());
  expect(localStorage.getItem('cv_fontsize')).toBe('0');
  localStorage.setItem('cv_fontsize', 'big');
  renderHook(() => useFontScale());
  expect(localStorage.getItem('cv_fontsize')).toBe('0');
});
