import { USER_STORAGE_KEY, getStoredUser, getLocalSetlists, getSetlistOverrides, saveSetlistOverride, searchKey, clearSearchSession } from '../storage';

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

it('builds search keys from one registry and clears exactly those', () => {
  expect(searchKey('browse', 'show_filters')).toBe('cv_browse_show_filters');
  expect(searchKey('publicsetlists', 'date_to')).toBe('cv_publicsetlists_date_to');
  sessionStorage.setItem('cv_setlists_page', '2');
  sessionStorage.setItem('unrelated', 'keep');
  clearSearchSession();
  expect(sessionStorage.getItem('cv_setlists_page')).toBeNull();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
});
