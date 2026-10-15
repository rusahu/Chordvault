export const ROLES = { OWNER: 'owner', ADMIN: 'admin', USER: 'user' };

export const STATUS = { ACTIVE: 'active', PENDING: 'pending' };

export const VISIBILITY = { PUBLIC: 'public', PRIVATE: 'private' };

export const isAdminRole = role => role === ROLES.ADMIN || role === ROLES.OWNER;

/** Anything other than "private" is stored as public. */
export const normalizeVisibility = visibility => (visibility === VISIBILITY.PRIVATE ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC);
