import type { LibraryQuery } from '../types/offline';

export function libraryQueryString(query: LibraryQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.language) params.set('language', query.language);
  if (query.tags?.length) params.set('tags', query.tags.join(','));
  if (query.dateFrom) params.set('date_from', query.dateFrom);
  if (query.dateTo) params.set('date_to', query.dateTo);
  params.set('page', String(query.page || 1));
  params.set('limit', String(query.limit || 20));
  return `?${params.toString().replace(/\+/g, '%20')}`;
}
