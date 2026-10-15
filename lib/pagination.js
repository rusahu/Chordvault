const { pageMeta, pageOffset } = require('../shared/paging.mjs');

function queryList(db, {
  sql, params = [], countSql, countParams = [],
  page = null, limit = null, resultKey, unpagedLimit = null,
}) {
  if (page === null || limit === null) {
    return unpagedLimit === null
      ? db.prepare(sql).all(...params)
      : db.prepare(`${sql} LIMIT ?`).all(...params, unpagedLimit);
  }
  const total = db.prepare(countSql).get(...countParams).count;
  const rows = db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...params, limit, pageOffset(page, limit));
  return { [resultKey]: rows, ...pageMeta(total, page, limit) };
}

module.exports = { queryList };
