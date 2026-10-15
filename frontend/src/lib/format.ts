/** SQLite CURRENT_TIMESTAMP is UTC without a zone; read it as UTC. */
export function parseDbTime(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
}

export const formatDbDate = (s: string | null | undefined) => (s ? parseDbTime(s).toLocaleDateString() : '');
