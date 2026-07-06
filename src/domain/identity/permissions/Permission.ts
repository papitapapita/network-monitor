import { UserRole } from '../value-objects/UserRole';

export type Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'activate'
  | 'bulk-import';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRole.ADMIN]: [
    'read',
    'create',
    'update',
    'delete',
    'activate',
    'bulk-import'
  ],
  [UserRole.OPERATOR]: [
    'read',
    'create',
    'update',
    'activate',
    'bulk-import'
  ],
  [UserRole.VIEWER]: ['read']
};
