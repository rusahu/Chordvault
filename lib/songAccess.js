const { VISIBILITY } = require('./constants');
const { canManageSong } = require('./auth');

function canViewSongVisibility(user, song) {
  return song.visibility === VISIBILITY.PUBLIC || canManageSong(user, song.user_id);
}

function maskSetlistEntry(entry, user) {
  if (!canViewSongVisibility(user, { visibility: entry.visibility, user_id: entry.song_user_id })) {
    return {
      entry_id: entry.entry_id, song_id: entry.song_id, position: entry.position,
      target_key: null, nashville: 0, content_override: null,
      title: '[Private Song]', artist: '', content: '', key: '',
      youtube_url: null, bpm: null, tags: null, language: '',
      username: '', is_private_placeholder: true,
    };
  }
  const { song_user_id: _, ...safe } = entry;
  return safe;
}

/** Setlist entry fields for display; aliases ss (entry), so (song), u (song owner). */
const ENTRY_COLUMNS = `ss.id AS entry_id, ss.song_id, ss.position, ss.target_key, ss.nashville, ss.font, ss.two_col, ss.content_override,
  so.title, so.artist, so.content, so.key, so.youtube_url, so.bpm, so.tags, so.language, so.visibility, so.user_id AS song_user_id, u.username`;

/** Songs the viewer may see; binds VISIBILITY.PUBLIC then the viewer id (0 when signed out). */
const visibleToViewer = alias => `(${alias}.visibility = ? OR ${alias}.user_id = ?)`;

const familyRootId = song => song.parent_id || song.id;

module.exports = { canViewSongVisibility, maskSetlistEntry, ENTRY_COLUMNS, visibleToViewer, familyRootId };
