const { queryList } = require('../pagination');
const { db } = require('../db');
const { VISIBILITY } = require('../constants');
const { getLikeSearch } = require('../searchUtils');
const { isValidDate } = require('../validation');
const { ENTRY_COLUMNS } = require('../songAccess');

// Prepared statements for setlists (static ones)
const findByIdStmt = db.prepare('SELECT * FROM setlists WHERE id = ? AND user_id = ?');
const findPublicByIdStmt = db.prepare('SELECT s.*, u.username FROM setlists s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.visibility = ?');

const createStmt = db.prepare('INSERT INTO setlists (user_id, name, visibility, event_date) VALUES (?, ?, ?, ?)');
const updateStmt = db.prepare('UPDATE setlists SET name = ?, visibility = ?, event_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
const deleteStmt = db.prepare('DELETE FROM setlists WHERE id = ? AND user_id = ?');

const getEntriesStmt = db.prepare(`
  SELECT ${ENTRY_COLUMNS}
  FROM setlist_songs ss
  JOIN songs so ON ss.song_id = so.id
  JOIN users u ON so.user_id = u.id
  WHERE ss.setlist_id = ?
  ORDER BY ss.position ASC
`);

const getEntryByIdStmt = db.prepare('SELECT * FROM setlist_songs WHERE id = ? AND setlist_id = ?');
const maxPositionStmt = db.prepare('SELECT MAX(position) as max FROM setlist_songs WHERE setlist_id = ?');
const insertEntryStmt = db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, target_key, nashville) VALUES (?, ?, ?, ?, ?)');
const updateEntryStmt = db.prepare(`UPDATE setlist_songs SET
  target_key = CASE WHEN ? THEN ? ELSE target_key END,
  nashville = COALESCE(?, nashville),
  font = COALESCE(?, font),
  two_col = COALESCE(?, two_col),
  content_override = ?
  WHERE id = ? AND setlist_id = ?`);
const deleteEntryStmt = db.prepare('DELETE FROM setlist_songs WHERE id = ? AND setlist_id = ?');
const updatePositionStmt = db.prepare('UPDATE setlist_songs SET position = ? WHERE id = ? AND setlist_id = ?');
const touchSetlistStmt = db.prepare('UPDATE setlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');

const touchSetlist = setlistId => touchSetlistStmt.run(setlistId);

const addSongEntryTransaction = db.transaction((setlistId, songId, targetKey, nashville) => {
  const position = (maxPositionStmt.get(setlistId).max || 0) + 1;
  const result = insertEntryStmt.run(setlistId, songId, position, targetKey || null, nashville ? 1 : 0);
  touchSetlist(setlistId);
  return { entry_id: result.lastInsertRowid, position };
});

const updateSongEntryTransaction = db.transaction((entryId, setlistId, entry, { targetKey, targetKeyProvided, nashville, font, twoCol, contentOverride }) => {
  updateEntryStmt.run(
    targetKeyProvided ? 1 : 0,
    targetKeyProvided ? (targetKey ?? null) : null,
    nashville !== undefined ? (nashville ? 1 : 0) : null,
    font !== undefined ? font : null,
    twoCol !== undefined ? (twoCol === null ? null : (twoCol ? 1 : 0)) : null,
    contentOverride !== undefined ? contentOverride : entry.content_override,
    entryId,
    setlistId
  );
  touchSetlist(setlistId);
});

const deleteSongEntryTransaction = db.transaction((entryId, setlistId) => {
  const result = deleteEntryStmt.run(entryId, setlistId);
  if (result.changes) touchSetlist(setlistId);
  return result;
});

const reorderEntriesTransaction = db.transaction((setlistId, entryIds) => {
  entryIds.forEach((entryId, i) => updatePositionStmt.run(i + 1, entryId, setlistId));
  touchSetlist(setlistId);
});

function dateRangeFilter(dateFrom, dateTo) {
  const filter = { sql: '', params: [] };
  for (const [value, op] of [[dateFrom, '>='], [dateTo, '<=']]) {
    const day = value?.trim();
    if (day && isValidDate(day)) {
      filter.sql += ` AND COALESCE(s.event_date, DATE(s.created_at)) ${op} ?`;
      filter.params.push(day);
    }
  }
  return filter;
}

/** Setlists with their song counts, latest event first. */
function listSetlists({ columns, from, where, whereParams, unpagedLimit = null }, { q, dateFrom, dateTo, page = null, limit = null } = {}) {
  let body = ` FROM ${from} LEFT JOIN setlist_songs ss ON s.id = ss.setlist_id WHERE ${where}`;
  const params = [...whereParams];
  for (const filter of [q?.trim() ? getLikeSearch(q) : null, dateRangeFilter(dateFrom, dateTo)]) {
    if (!filter) continue;
    body += filter.sql;
    params.push(...filter.params);
  }
  return queryList(db, {
    sql: `SELECT ${columns}, COUNT(ss.id) as song_count${body} GROUP BY s.id ORDER BY s.event_date DESC, s.updated_at DESC`,
    params,
    countSql: `SELECT COUNT(DISTINCT s.id) as count${body}`,
    countParams: params,
    page, limit, resultKey: 'setlists', unpagedLimit,
  });
}

module.exports = {
  // Read operations
  findById: (id, userId) => findByIdStmt.get(id, userId),
  findPublicById: (id) => findPublicByIdStmt.get(id, VISIBILITY.PUBLIC),
  getEntries: (id) => getEntriesStmt.all(id),
  getEntryById: (entryId, setlistId) => getEntryByIdStmt.get(entryId, setlistId),

  // Dynamic lists
  listForUser: (userId, filters) => listSetlists({ columns: 's.*', from: 'setlists s', where: 's.user_id = ?', whereParams: [userId] }, filters),
  listPublic: (filters) => listSetlists({
    columns: 's.*, u.username',
    from: 'setlists s JOIN users u ON s.user_id = u.id',
    where: 's.visibility = ?',
    whereParams: [VISIBILITY.PUBLIC],
    unpagedLimit: 100,
  }, filters),

  // Write operations
  create: (userId, name, visibility, eventDate) => {
    return createStmt.run(userId, name, visibility, eventDate);
  },

  update: (id, userId, name, visibility, eventDate) => {
    return updateStmt.run(name, visibility, eventDate, id, userId);
  },

  delete: (id, userId) => {
    return deleteStmt.run(id, userId);
  },

  // Setlist songs operations
  addSongEntry: (setlistId, songId, { targetKey, nashville }) => {
    return addSongEntryTransaction(setlistId, songId, targetKey, nashville);
  },

  updateSongEntry: (entryId, setlistId, entry, updates) => {
    updateSongEntryTransaction(entryId, setlistId, entry, updates);
    return { success: true };
  },

  deleteSongEntry: (entryId, setlistId) => {
    return deleteSongEntryTransaction(entryId, setlistId);
  },

  reorderEntries: (setlistId, entryIds) => {
    reorderEntriesTransaction(setlistId, entryIds);
    return { success: true };
  },
};
