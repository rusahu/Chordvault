import type { User, LocalSetlist } from '../types';
import { legacyTransposeToTargetKey } from './setlistKeys';

export const USER_STORAGE_KEY = 'cv_user';
const LOCAL_SETLISTS_KEY = 'cv_local_setlists';
const SETLIST_OVERRIDES_KEY = 'cv_setlist_overrides';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export const getStoredUser = (): User | null => readJson<User | null>(USER_STORAGE_KEY, null);

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}

export const getLocalSetlists = (): LocalSetlist[] => readJson<LocalSetlist[]>(LOCAL_SETLISTS_KEY, []);

export function saveLocalSetlists(arr: LocalSetlist[]): void {
  localStorage.setItem(LOCAL_SETLISTS_KEY, JSON.stringify(arr));
}

interface SetlistOverride {
  target_key?: string | null;
  transpose?: number;          // legacy, read-only
  nashville?: boolean;
  font?: number;
  two_col?: number | null;
}

/**
 * Gets personal key/Nashville overrides for a specific setlist.
 * Format: { [entryId]: { target_key: string | null, nashville: boolean, font: number, two_col: boolean } }
 * May also contain legacy { transpose: number, ... } records; pass through
 * migrateOverride() before use.
 */
export function getSetlistOverrides(setlistId: number | string): Record<string, SetlistOverride> {
  return readJson<Record<string, Record<string, SetlistOverride>> | null>(SETLIST_OVERRIDES_KEY, {})?.[String(setlistId)] || {};
}

/**
 * Saves a personal key/Nashville override for a single setlist entry.
 */
export function saveSetlistOverride(
  setlistId: number | string,
  entryId: number | string,
  data: SetlistOverride
): void {
  try {
    const all = readJson<Record<string, Record<string, SetlistOverride>>>(SETLIST_OVERRIDES_KEY, {});
    const sid = String(setlistId);
    const eid = String(entryId);
    if (!all[sid]) all[sid] = {};
    all[sid][eid] = { ...all[sid][eid], ...data };
    delete all[sid][eid].transpose; // legacy field never written going forward; drop it on every save
    localStorage.setItem(SETLIST_OVERRIDES_KEY, JSON.stringify(all));
  } catch (e) { console.error('Failed to save setlist override', e); }
}

/**
 * Converts a stored override to the target-key shape.
 *
 * Overrides predating 1.23.0 hold an accumulated `transpose` and were never
 * range-checked, so a value that drifted before the fix can still be sitting
 * in a browser. Converting on read means no saved personal key is lost.
 */
export function migrateOverride(
  override: SetlistOverride,
  content: string
): SetlistOverride {
  const { transpose, ...rest } = override;
  if (rest.target_key !== undefined) return rest;
  return { ...rest, target_key: legacyTransposeToTargetKey(content, transpose) };
}

function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

const SEARCH_FIELDS = {
  browse: ['query', 'lang', 'tags', 'show_filters', 'page'],
  mysongs: ['query', 'page'],
  publicsetlists: ['query', 'date_from', 'date_to', 'show_dates', 'page'],
  setlists: ['query', 'date_from', 'date_to', 'show_dates', 'page'],
} as const;

type SearchView = keyof typeof SEARCH_FIELDS;
const sessionKey = (view: string, field: string) => `cv_${view}_${field}`;

/** Session key for a list view's saved search field; every key in the registry is cleared on sign in and out. */
export const searchKey = <V extends SearchView>(view: V, field: (typeof SEARCH_FIELDS)[V][number]) => sessionKey(view, field);

export function clearSearchSession(): void {
  for (const [view, fields] of Object.entries(SEARCH_FIELDS)) {
    for (const field of fields) removeSessionItem(sessionKey(view, field));
  }
}
