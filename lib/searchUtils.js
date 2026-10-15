const OpenCC = require('opencc-js');

// Initialize converters once to avoid reloading dictionaries
const convertToTrad = OpenCC.Converter({ from: 'cn', to: 'tw' });
const convertToSimp = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * Generates search variants for Chinese queries.
 * @param {string} q - The raw search query
 * @returns {object} { qClean, qTrad, qSimp, hasVariants }
 */
function getSearchVariants(q) {
  const qClean = q.trim();
  const qTrad = convertToTrad(qClean);
  const qSimp = convertToSimp(qClean);
  return { qClean, qTrad, qSimp, hasVariants: qTrad !== qSimp };
}

const variantForms = ({ qClean, qTrad, qSimp, hasVariants }) => (hasVariants ? [qTrad, qSimp] : [qClean]);

/** Space-free lowercase, the form the pinyin column stores. */
const pinyinKey = (text) => text.replace(/\s+/g, '').toLowerCase();

const SONGS_SEARCH_JOIN = ' JOIN songs_search ss ON s.id = ss.rowid';

// FTS5's trigram tokenizer indexes 3-char sequences, so MATCH cannot hit on
// queries shorter than this — a real limitation for 2-char CJK words (e.g. 喜樂).
const FTS_MIN_LEN = 3;

const escapeFts = (str) => str.replace(/"/g, '""');

/** The words of a query; an empty query is one empty word, which matches everything. */
const queryWords = (str) => {
  const words = str.trim().split(/\s+/).filter(Boolean);
  return words.length ? words : [''];
};

// Turn a query into an AND of individually-quoted trigram terms:
// "amazing grace" -> '"amazing" AND "grace"'. Order/whitespace independent.
function ftsMatchExpr(str) {
  return queryWords(str).map((t) => `"${escapeFts(t)}"`).join(' AND ');
}

/**
 * Returns SQL snippet and params for SQLite FTS5 MATCH search.
 * Text query hits title/artist/lyrics; a space-stripped copy hits the pinyin
 * column, so romanized input matches without any query-language detection.
 * @param {string} q - The search query
 * @returns {object} { sql, params }
 */
function getFtsSearch(q) {
  const variants = getSearchVariants(q);
  const forms = variantForms(variants);
  const textBranch = forms.map((f) => `{title artist lyrics}:(${ftsMatchExpr(f)})`).join(' OR ');
  const pinyinBranch = `pinyin:"${escapeFts(pinyinKey(variants.qClean))}"`;
  return { sql: ' AND songs_search MATCH ?', params: [`${textBranch} OR ${pinyinBranch}`] };
}

/**
 * Unified song search clause. Long queries use the FTS5 trigram index;
 * short queries (< FTS_MIN_LEN) fall back to LIKE, which trigram can't index.
 * @param {string} q - The search query
 * @returns {object} { join, sql, params, score, scoreParams }: `join` is the FROM-clause
 *   join to append before WHERE (empty string when no join is needed); `sql` is the
 *   AND-clause; `params` are its bound values; `score` ranks a row (see getRelevanceScore).
 */
function getSongSearch(q) {
  const variants = getSearchVariants(q);

  const base = queryWords(variants.qClean).some((word) => word.length < FTS_MIN_LEN)
    ? getLikeSongSearch(variants)
    : { join: SONGS_SEARCH_JOIN, ...getFtsSearch(q) };

  return { ...base, ...getRelevanceScore(variants) };
}

/**
 * Relevance score for a search query: title (3) > artist (2) > pinyin (1) > lyrics-only (0).
 * bm25() is degenerate on a trigram index, so rank by WHERE the term hits. Pinyin
 * outranks lyrics so "wo ai ni" puts 我爱你 above lyrics that merely contain "wo", "ai", "ni".
 * Both paths join songs_search, so ss.pinyin is always available.
 * @param {object} variants - { qClean, qTrad, qSimp, hasVariants } from getSearchVariants
 * @returns {object} { score, scoreParams } - a per-row CASE expression and its bound values
 */
function getRelevanceScore(variants) {
  const forms = variantForms(variants);
  const tokenized = forms.map(queryWords);

  // A field "matches" if it contains ALL tokens of ANY variant form.
  const cond = (col) =>
    tokenized.map((toks) => '(' + toks.map(() => `${col} LIKE ?`).join(' AND ') + ')').join(' OR ');
  const likes = tokenized.flatMap((toks) => toks.map((t) => `%${t}%`));

  return {
    score: `CASE WHEN ${cond('s.title')} THEN 3 WHEN ${cond('s.artist')} THEN 2 WHEN ss.pinyin LIKE ? THEN 1 ELSE 0 END`,
    scoreParams: [...likes, ...likes, `%${pinyinKey(variants.qClean)}%`],
  };
}

/**
 * Song search for a query with any word shorter than FTS_MIN_LEN, which the
 * trigram index cannot match. LIKE-scans the songs_search columns (lyrics there
 * are already stripped of [chords]/{directives}, the same scope as FTS): every
 * word must appear in the title, artist or lyrics, as the offline search does.
 * Trad/Simp variants are honored so a query in either script finds the other.
 * @param {object} variants - { qClean, qTrad, qSimp, hasVariants } from getSearchVariants
 * @returns {object} { join, sql, params }
 */
function getLikeSongSearch(variants) {
  const cols = ['ss.title', 'ss.artist', 'ss.lyrics'];
  const wordMatch = `(${cols.map((c) => `${c} LIKE ?`).join(' OR ')})`;

  const groups = [];
  const params = [];
  for (const form of variantForms(variants)) {
    const words = queryWords(form);
    groups.push(`(${words.map(() => wordMatch).join(' AND ')})`);
    params.push(...words.flatMap((word) => cols.map(() => `%${word}%`)));
  }

  // Pinyin column: space-stripped, lowercase (matches how it's stored).
  groups.push('ss.pinyin LIKE ?');
  params.push(`%${pinyinKey(variants.qClean)}%`);

  return {
    join: SONGS_SEARCH_JOIN,
    sql: ` AND (${groups.join(' OR ')})`,
    params,
  };
}

/**
 * Returns SQL snippet and params for standard LIKE search.
 * @param {string} q - The search query
 * @param {string} column - The column name to search (default 's.name')
 * @returns {object} { sql, params }
 */
function getLikeSearch(q, column = 's.name') {
  const { qClean, qTrad, qSimp, hasVariants } = getSearchVariants(q);

  if (hasVariants) {
    return {
      sql: ` AND (${column} LIKE ? OR ${column} LIKE ?)`,
      params: [`%${qTrad}%`, `%${qSimp}%`],
    };
  }
  return {
    sql: ` AND ${column} LIKE ?`,
    params: [`%${qClean}%`],
  };
}

/** Songs with at least one of the tags. instr, not LIKE, so `_` and `%` in a name stay literal. */
function getTagFilter(tags) {
  if (!tags?.length) return { sql: '', params: [] };
  const match = "instr(',' || s.tags || ',', ',' || ? || ',') > 0";
  return { sql: ` AND (${tags.map(() => match).join(' OR ')})`, params: tags };
}

module.exports = { getLikeSearch, getSongSearch, getSearchVariants, getTagFilter, pinyinKey };
