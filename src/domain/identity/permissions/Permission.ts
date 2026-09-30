import { UserRole } from '../value-objects/UserRole';

export type Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'activate'
  | 'bulk-import'
  | 'manage-credentials'
  | 'manage-users'
  | 'manage-installation';

const ADMIN_PERMISSIONS: Permission[] = [
  'read',
  'create',
  'update',
  'delete',
  'activate',
  'bulk-import',
  'manage-credentials',
  'manage-users'
];

// VENDOR is the company that sells and runs the install; ADMIN is the
// customer's own administrator. What only the vendor may do sits on
// manage-installation.
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRole.VENDOR]: [...ADMIN_PERMISSIONS, 'manage-installation'],
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.OPERATOR]: [
    'read',
    'create',
    'update',
    'activate',
    'bulk-import'
  ],
  [UserRole.VIEWER]: ['read']
};
