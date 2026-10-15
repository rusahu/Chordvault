import { act, renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

const searchKeys = [
  'cv_browse_query', 'cv_browse_lang', 'cv_browse_tags', 'cv_browse_show_filters', 'cv_browse_page',
  'cv_mysongs_query', 'cv_mysongs_page',
  'cv_publicsetlists_query', 'cv_publicsetlists_date_from', 'cv_publicsetlists_date_to',
  'cv_publicsetlists_show_dates', 'cv_publicsetlists_page',
  'cv_setlists_query', 'cv_setlists_date_from', 'cv_setlists_date_to',
  'cv_setlists_show_dates', 'cv_setlists_page',
];
const user = { id: 1, username: 'demo', role: 'user', token: 'test-token' };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it.each(['login', 'logout'] as const)('%s clears search state without erasing other preferences', (action) => {
  for (const key of searchKeys) sessionStorage.setItem(key, 'old search');
  sessionStorage.setItem('unrelated', 'keep');
  localStorage.setItem('cv_fontsize', '2');
  localStorage.setItem('cv_local_setlists', '[{"id":"local_1"}]');
  if (action === 'logout') localStorage.setItem('cv_user', JSON.stringify(user));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  act(() => { if (action === 'login') result.current.login(user); else result.current.logout(); });
  for (const key of searchKeys) expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
  expect(localStorage.getItem('cv_fontsize')).toBe('2');
  expect(localStorage.getItem('cv_local_setlists')).toBe('[{"id":"local_1"}]');
  expect(result.current.user).toEqual(action === 'login' ? user : null);
  expect(localStorage.getItem('cv_user')).toBe(action === 'login' ? JSON.stringify(user) : null);
});

it('still logs in when a browser blocks session cleanup', () => {
  const remove = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
    if (this === sessionStorage) throw new DOMException('Blocked', 'SecurityError');
    return remove.call(this, key);
  });
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  act(() => result.current.login(user));
  expect(result.current.user).toEqual(user);
});
