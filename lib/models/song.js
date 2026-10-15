const { queryList } = require('../pagination');
const { db } = require('../db');
const { STATUS, VISIBILITY } = require('../constants');
const { getSongSearch, getTagFilter } = require('../searchUtils');
const { computeSongHash } = require('../songHash');
const { dedupeSongs } = require('../importDedup');
const { visibleToViewer } = require('../songAccess');

const familyKey = alias => `COALESCE(${alias}.parent_id, ${alias}.id)`;

// Prepared statements for song-related queries (static ones)
const findByIdStmt = db.prepare('SELECT s.*, u.username FROM songs s JOIN users u ON s.user_id = u.id WHERE s.id = ?');

const countVersionStmt = db.prepare(`
  SELECT COUNT(*) as count FROM songs s
  WHERE ${familyKey('s')} = COALESCE(?, ?) AND s.status = ? AND ${visibleToViewer('s')}
`);


const updateStmt = db.prepare(`
  UPDATE songs SET title=?, artist=?, key=?, content=?, visibility=?, youtube_url=?, format_detected=?, bpm=?, tags=?, language=?, content_hash=?, updated_at=CURRENT_TIMESTAMP
  WHERE id=?
`);

const deleteStmt = db.prepare('DELETE FROM songs WHERE id = ?');
const deleteByOwnerStmt = db.prepare('DELETE FROM songs WHERE id = ? AND user_id = ?');

const getVersionsStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.key, s.created_at, s.updated_at, s.parent_id, s.youtube_url, u.username
  FROM songs s JOIN users u ON s.user_id = u.id
  WHERE (s.id = ? OR s.parent_id = ?) AND s.status = ? AND ${visibleToViewer('s')}
  ORDER BY s.created_at ASC
`);

const getCorrectionsStmt = db.prepare(`
  SELECT c.id, c.content, c.youtube_url, c.created_at, u.username
  FROM songs c JOIN users u ON c.user_id = u.id
  WHERE c.parent_id = ? AND c.status = ?
  ORDER BY c.created_at ASC
`);

const getPendingCorrectionsStmt = db.prepare(`
  SELECT c.id, c.title, c.created_at, c.parent_id, u.username as submitter
  FROM songs c JOIN users u ON c.user_id = u.id
  WHERE c.status = ?
  ORDER BY c.created_at ASC
`);

const countSongsStmt = db.prepare('SELECT COUNT(*) as count FROM songs');
const countPendingStmt = db.prepare('SELECT COUNT(*) as count FROM songs WHERE status = ?');
const countNoFormatStmt = db.prepare("SELECT COUNT(*) as count FROM songs WHERE format_detected IS NULL AND content != '' AND status = ?");
const languageDistributionStmt = db.prepare(`
  SELECT language, COUNT(*) as count FROM songs
  WHERE status = ? AND language != ''
  GROUP BY language
  ORDER BY count DESC
`);
const getRecentSongsStmt = db.prepare(`
  SELECT s.id, s.title, s.artist, s.visibility, s.created_at, u.username
  FROM songs s JOIN users u ON s.user_id = u.id
  ORDER BY s.created_at DESC LIMIT ?
`);

const selectUserHashesStmt = db.prepare('SELECT content_hash FROM songs WHERE user_id = ?');

const exportUserStmt = db.prepare(`SELECT s.id, s.title, s.content FROM songs s WHERE s.status = ? AND ${visibleToViewer('s')}`);
const exportAdminStmt = db.prepare('SELECT id, title, content FROM songs WHERE status = ?');

const updateContentStmt = db.prepare('UPDATE songs SET content = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

// Correction approval transaction
const approveCorrectionTransaction = db.transaction((content, originalId, correctionId) => {
  updateContentStmt.run(content, computeSongHash(content), originalId);
  deleteStmt.run(correctionId);
});

const insertStmt = db.prepare(`
  INSERT INTO songs (user_id, title, artist, key, content, visibility, parent_id, youtube_url, format_detected, bpm, tags, status, language, content_hash)
  VALUES (@userId, @title, @artist, @key, @content, @visibility, @parentId, @youtubeUrl, @formatDetected, @bpm, @tags, @status, @language, @contentHash)
`);

/** Stores trimmed content and its hash; only new songs record a detected format. */
function insertSong(userId, meta, content, { visibility, parentId = null, formatDetected = null, status = STATUS.ACTIVE }) {
  const trimmed = content.trim();
  return insertStmt.run({
    userId, title: meta.title, artist: meta.artist, key: meta.key, youtubeUrl: meta.youtube_url, bpm: meta.bpm, tags: meta.tags, language: meta.language,
    content: trimmed, visibility, parentId, formatDetected, status, contentHash: computeSongHash(trimmed),
  });
}

const insertImportedTransaction = db.transaction((userId, rows) => {
  for (const row of rows) insertSong(userId, row, row.content, { visibility: row.visibility });
});

const versionCountSql = `(SELECT COUNT(*) FROM songs v WHERE ${familyKey('v')} = ${familyKey('s')} AND v.status = ? AND ${visibleToViewer('v')}) as version_count`;

/** One row per song family, by relevance when searching, then newest first. */
function listFamilies({ columns, from, where, whereParams, viewerId = 0, unpagedLimit = null }, { q, language, tags = [], page = null, limit = null } = {}) {
  const search = q?.trim() ? getSongSearch(q) : null;
  let body = ` FROM ${from}${search ? search.join : ''} WHERE ${where}`;
  const bodyParams = [...whereParams];
  if (search) {
    body += search.sql;
    bodyParams.push(...search.params);
  }
  if (language?.trim()) {
    body += ' AND s.language = ?';
    bodyParams.push(language.trim());
  }
  const tagFilter = getTagFilter(tags);
  body += tagFilter.sql;
  bodyParams.push(...tagFilter.params);
  return queryList(db, {
    sql: `SELECT ${columns}, ${versionCountSql}${body} GROUP BY ${familyKey('s')} ORDER BY ${search ? search.orderBy : ''}MAX(s.updated_at) DESC`,
    params: [STATUS.ACTIVE, VISIBILITY.PUBLIC, viewerId, ...bodyParams, ...(search ? search.orderParams : [])],
    countSql: `SELECT COUNT(DISTINCT ${familyKey('s')}) as count${body}`,
    countParams: bodyParams,
    page, limit, resultKey: 'songs', unpagedLimit,
  });
}

module.exports = {
  // Read operations
  findById: (id) => findByIdStmt.get(id),
  getVersionCount: (parentId, songId, userId) => countVersionStmt.get(parentId, songId, STATUS.ACTIVE, VISIBILITY.PUBLIC, userId).count,
  listByUser: (targetUserId, { page = null, limit = null } = {}) => listFamilies({
    columns: 's.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.updated_at',
    from: 'songs s',
    where: 's.user_id = ? AND s.visibility = ? AND s.status = ?',
    whereParams: [targetUserId, VISIBILITY.PUBLIC, STATUS.ACTIVE],
  }, { page, limit }),
  getVersions: (rootId, userId) => getVersionsStmt.all(rootId, rootId, STATUS.ACTIVE, VISIBILITY.PUBLIC, userId),
  getCorrections: (rootId) => getCorrectionsStmt.all(rootId, STATUS.PENDING),

  listForUser: (userId, filters = {}) => listFamilies({
    columns: 's.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.created_at, s.updated_at',
    from: 'songs s',
    where: 's.user_id = ? AND s.status = ?',
    whereParams: [userId, STATUS.ACTIVE],
    viewerId: userId,
  }, filters),

  listPublic: ({ userId = 0, ...filters } = {}) => listFamilies({
    columns: 's.id, s.title, s.artist, s.key, s.bpm, s.tags, s.language, s.visibility, s.updated_at, u.username',
    from: 'songs s JOIN users u ON s.user_id = u.id',
    where: 's.visibility = ? AND s.status = ?',
    whereParams: [VISIBILITY.PUBLIC, STATUS.ACTIVE],
    viewerId: userId,
    unpagedLimit: 100,
  }, filters),

  // Write operations
  create: (userId, meta, content, visibility, formatDetected) => insertSong(userId, meta, content, { visibility, formatDetected }),

  update: (id, meta, content, visibility, formatDetected) => {
    return updateStmt.run(meta.title, meta.artist, meta.key, content, visibility, meta.youtube_url, formatDetected, meta.bpm, meta.tags, meta.language, computeSongHash(content.trim()), id);
  },

  delete: (id, userId = null) => {
    if (userId !== null) {
      return deleteByOwnerStmt.run(id, userId);
    }
    return deleteStmt.run(id);
  },

  importSongs: (userId, songs) => {
    const existing = new Set(selectUserHashesStmt.all(userId).map((r) => r.content_hash));
    const { toInsert, skipped } = dedupeSongs(existing, songs);
    insertImportedTransaction(userId, toInsert);
    return { imported: toInsert.length, skipped };
  },

  createVersion: (userId, parentId, meta, content, visibility) => insertSong(userId, meta, content, { visibility, parentId }),

  createCorrection: (userId, parentId, meta, content) => insertSong(userId, meta, content, { visibility: VISIBILITY.PUBLIC, parentId, status: STATUS.PENDING }),

  approveCorrection: (correctionId, originalId, content) => {
    approveCorrectionTransaction(content, originalId, correctionId);
    return { success: true };
  },

  deleteCorrection: (correctionId) => {
    return deleteStmt.run(correctionId);
  },

  // Admin stats operations
  count: () => countSongsStmt.get().count,
  countPending: () => countPendingStmt.get(STATUS.PENDING).count,
  countNoFormat: () => countNoFormatStmt.get(STATUS.ACTIVE).count,
  getLanguageDistribution: () => languageDistributionStmt.all(STATUS.ACTIVE),
  getRecent: (limit) => getRecentSongsStmt.all(limit),
  getPendingCorrections: () => getPendingCorrectionsStmt.all(STATUS.PENDING),

  iterateExportable(userId, isAdmin) {
    return isAdmin
      ? exportAdminStmt.iterate(STATUS.ACTIVE)
      : exportUserStmt.iterate(STATUS.ACTIVE, VISIBILITY.PUBLIC, userId);
  },
};
