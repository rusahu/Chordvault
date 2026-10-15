import { USER_STORAGE_KEY, getStoredUser, getLocalSetlists, getSetlistOverrides, saveSetlistOverride } from '../storage';

beforeEach(() => localStorage.clear());

it('names the signed-in user key once', () => {
  expect(USER_STORAGE_KEY).toBe('cv_user');
});

it('reads stored JSON and falls back on missing or corrupt values', () => {
  expect(getStoredUser()).toBeNull();
  localStorage.setItem('cv_user', '{bad');
  expect(getStoredUser()).toBeNull();
  localStorage.setItem('cv_local_setlists', 'not json');
  expect(getLocalSetlists()).toEqual([]);
  localStorage.setItem('cv_setlist_overrides', 'null');
  expect(getSetlistOverrides(1)).toEqual({});
  localStorage.setItem('cv_setlist_overrides', JSON.stringify({ 1: { e1: { target_key: 'D' } } }));
  expect(getSetlistOverrides(1)).toEqual({ e1: { target_key: 'D' } });
});

it('overwrites corrupt stored overrides on save instead of failing (accepted change)', () => {
  localStorage.setItem('cv_setlist_overrides', '{bad');
  saveSetlistOverride(1, 'e1', { target_key: 'D' });
  expect(getSetlistOverrides(1)).toEqual({ e1: { target_key: 'D' } });
});
