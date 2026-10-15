const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Value of `{name: value}` at the start of a line (leading spaces allowed, any case), or null. */
export function extractDirective(content, name) {
  const m = content.match(new RegExp(`^[ \\t]*\\{${escapeRe(name)}:\\s*([^}]*)\\}`, 'im'));
  return m ? m[1].trim() : null;
}

/** Whole-number tempo within [min, max], else null. */
export function parseBpm(value, min, max) {
  const s = value?.trim();
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}
