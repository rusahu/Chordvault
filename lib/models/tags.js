const { db, getSetting, setSetting } = require('../db');
const { STATUS } = require('../constants');
const { DEFAULT_TAGS } = require('../../shared/public-constants.json');
const { splitTags } = require('../../shared/tags.mjs');

const KEY = 'song_tags';
const deleteStmt = db.prepare('DELETE FROM settings WHERE key = ?');
const activeTagsStmt = db.prepare("SELECT tags FROM songs WHERE status = ? AND tags IS NOT NULL AND tags <> ''");

function parseStored(raw) {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.every(name => typeof name === 'string') ? list : null;
  } catch {
    return null;
  }
}

const getTags = () => {
  const raw = getSetting(KEY);
  return (raw !== null && parseStored(raw)) || DEFAULT_TAGS;
};

const isDefault = () => getSetting(KEY) === null;

function usageCounts() {
  const counts = new Map();
  for (const { tags } of activeTagsStmt.all(STATUS.ACTIVE)) {
    for (const name of splitTags(tags)) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function withUsage() {
  const counts = usageCounts();
  return { tags: getTags().map(name => ({ name, count: counts.get(name) || 0 })), isDefault: isDefault() };
}

module.exports = {
  getTags,
  isDefault,
  saveTags: list => setSetting(KEY, JSON.stringify(list)),
  resetTags: () => deleteStmt.run(KEY),
  withUsage,
};
