import { act, renderHook } from '@testing-library/react';
import { useSearchSessionValue, useSessionField, useSessionToggle } from '../useSearchSessionValue';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it.each(['恩典 Amazing Grace', 'true', 'false', '4', ''])('preserves the raw string %s without JSON quoting', value => {
  sessionStorage.setItem('cv_browse_query', value);
  const hook = renderHook(() => useSearchSessionValue('cv_browse_query'));
  expect(hook.result.current[0]).toBe(value);
  act(() => hook.result.current[1]('Holy'));
  expect(sessionStorage.getItem('cv_browse_query')).toBe('Holy');
  hook.unmount();
  expect(renderHook(() => useSearchSessionValue('cv_browse_query')).result.current[0]).toBe('Holy');
});

it('keeps working when browser storage is blocked', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  const { result } = renderHook(() => useSearchSessionValue('cv_browse_query'));
  expect(result.current[0]).toBe('');
  act(() => result.current[1]('Grace'));
  expect(result.current[0]).toBe('Grace');
});

it('keeps a draft apart from the saved value until it is saved', () => {
  sessionStorage.setItem('cv_mysongs_query', 'Grace');
  const { result } = renderHook(() => useSessionField('cv_mysongs_query'));
  expect(result.current[0]).toBe('Grace');
  act(() => result.current[1]('Gra'));
  expect(result.current[0]).toBe('Gra');
  expect(sessionStorage.getItem('cv_mysongs_query')).toBe('Grace');
  act(() => result.current[2]('Holy'));
  expect(sessionStorage.getItem('cv_mysongs_query')).toBe('Holy');
  expect(result.current[0]).toBe('Gra');
});

it('toggles a saved true/false flag', () => {
  const { result } = renderHook(() => useSessionToggle('cv_setlists_show_dates'));
  expect(result.current[0]).toBe(false);
  act(() => result.current[1]());
  expect(result.current[0]).toBe(true);
  expect(sessionStorage.getItem('cv_setlists_show_dates')).toBe('true');
  act(() => result.current[1]());
  expect(sessionStorage.getItem('cv_setlists_show_dates')).toBe('false');
});
