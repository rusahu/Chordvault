export declare const ROLES: { readonly OWNER: 'owner'; readonly ADMIN: 'admin'; readonly USER: 'user' };
export declare const STATUS: { readonly ACTIVE: 'active'; readonly PENDING: 'pending' };
export declare const VISIBILITY: { readonly PUBLIC: 'public'; readonly PRIVATE: 'private' };
export type Visibility = 'public' | 'private';
export declare function isAdminRole(role: string | undefined): boolean;
export declare function normalizeVisibility(visibility: unknown): Visibility;
export declare function manageUserError(actor: { id: number; role: string }, target: { id: number; role: string }): string | null;
