import { entryContent, legacyTransposeToTargetKey } from './setlistKeys';
import { getSetlistOverrides, migrateOverride, saveSetlistOverride } from './storage';
import { VISIBILITY } from './constants';
import type { LocalSetlist, LocalSetlistEntry, Setlist, SetlistEntry, SetlistListItem, Song } from '../types';

/**
 * Format a minimal local setlist entry from storage into a SetlistEntry.
 * Used for listing and metadata views where song contents are not yet loaded.
 *
 * A legacy `transpose` is NOT converted here: with no song content there is no
 * key to convert it against. Null is safe for these views because key stepping
 * is already inert without a derivable key (getSongKey('', 0) === ''); the
 * player converts the legacy value in enrichLocalEntry, where content exists.
 */
export function formatLocalEntry(e: LocalSetlistEntry, idx: number): SetlistEntry {
  return {
    entry_id: `local_${idx}`,
    song_id: e.song_id,
    title: e.title,
    artist: e.artist || '',
    target_key: e.target_key ?? null,
    nashville: e.nashville || 0,
    content: '',
    content_override: null,
    bpm: null,
    youtube_url: null,
    language: 'en',
  };
}

/**
 * Enrich a local setlist entry with song data.
 * Used when initializing playback or editing views requiring full song details.
 */
export function enrichLocalEntry(e: LocalSetlistEntry, song: Song | null, idx: number): SetlistEntry | null {
  if (!song) return { ...formatLocalEntry(e, idx), title: `${e.title} (not downloaded)`, is_private_placeholder: true, not_downloaded: true };
  return {
    song_id: song.id,
    entry_id: `local_${idx}`,
    title: song.title,
    artist: song.artist || '',
    content: song.content,
    content_override: null,
    // Entries saved before 1.23.0 hold an accumulated `transpose` and no
    // target_key; converting on read keeps the key they were played in. The
    // test is presence, not nullishness: a stored null is an explicit
    // "as written" and must win over a leftover transpose, the same precedence
    // migrateOverride applies to localStorage overrides.
    target_key: e.target_key !== undefined ? e.target_key : legacyTransposeToTargetKey(song.content, e.transpose),
    nashville: e.nashville ?? 0,
    bpm: song.bpm || null,
    youtube_url: song.youtube_url || null,
    language: song.language || 'en',
  };
}

/**
 * Asynchronously fetches full song details for the entries of a local setlist
 * and returns the list of enriched SetlistEntry objects.
 */
export async function enrichLocalSetlistSongs(
  entries: LocalSetlistEntry[],
  getSong: (id: number) => Promise<Song>
): Promise<SetlistEntry[]> {
  const uniqueSongIds = Array.from(new Set(entries.map((e) => e.song_id)));
  const cache: Record<number, Song | null> = {};

  const fetches = uniqueSongIds.map((id) =>
    getSong(id)
      .then((song) => {
        cache[id] = song;
      })
      .catch(() => {
        cache[id] = null;
      })
  );
  await Promise.all(fetches);

  return entries
    .map((e, i) => enrichLocalEntry(e, cache[e.song_id], i))
    .filter(Boolean) as SetlistEntry[];
}

export function localSetlistToSetlist(sl: LocalSetlist, entries: SetlistEntry[]): Setlist {
  return { id: sl.id, name: sl.name, entries, isLocal: true, visibility: VISIBILITY.PRIVATE, event_date: null };
}

export function localSetlistToListItem(sl: LocalSetlist): SetlistListItem {
  return { id: sl.id, name: sl.name, visibility: VISIBILITY.PRIVATE, song_count: sl.entries.length, event_date: null };
}

/**
 * Merges the browser's stored overrides onto freshly loaded entries.
 *
 * A stored override wins even when its target_key is null: null means "play as
 * written", which is a choice the user saved, so it must not fall back to the
 * server's pinned key. An override holding no key decision at all (only layout
 * fields) leaves the entry's own key alone. Legacy records are converted to a
 * target key and written back.
 */
export function applyStoredOverrides(setlistId: number | string, entries: SetlistEntry[]) {
  const overrides = getSetlistOverrides(setlistId);
  const targetKeys: Record<string, string | null> = {};
  const merged = entries.map((en) => {
    const raw = overrides[String(en.entry_id)];
    const ov = raw ? migrateOverride(raw, entryContent(en)) : undefined;
    if (raw && raw.transpose !== undefined) {
      saveSetlistOverride(setlistId, en.entry_id, ov!);
    }
    const storedKey = raw && ('target_key' in raw || 'transpose' in raw);
    const targetKey = (storedKey ? ov!.target_key : en.target_key) ?? null;
    targetKeys[String(en.entry_id)] = targetKey;
    return { ...en, target_key: targetKey, nashville: 0 };
  });
  return { entries: merged, targetKeys };
}
