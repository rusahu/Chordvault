/** Paging fields every list response carries. */
export const pageMeta = (total, page, limit) => ({ total, page, limit, totalPages: Math.ceil(total / limit) });

export const pageOffset = (page, limit) => (page - 1) * limit;
