/** Lowercase with single spaces, the form search text is stored and matched in. */
export const normalizeSearchText = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Space-free lowercase, the form the pinyin column stores. */
export const pinyinKey = (text) => text.replace(/\s+/g, '').toLowerCase();
