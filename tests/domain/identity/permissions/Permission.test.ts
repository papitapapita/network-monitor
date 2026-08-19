// Source: src/domain/identity/permissions/Permission.ts

import {
  Permission,
  ROLE_PERMISSIONS
} from '../../../../src/domain/identity/permissions/Permission';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';

describe('ROLE_PERMISSIONS', () => {
  // =========================================================================
  describe('ADMIN permissions', () => {
    const adminPerms: Permission[] = ROLE_PERMISSIONS[UserRole.ADMIN];

    it('should grant exactly 7 permissions', () => {
      expect(adminPerms).toHaveLength(7);
    });

    it('should include read', () => {
      expect(adminPerms).toContain('read');
    });

    it('should include create', () => {
      expect(adminPerms).toContain('create');
    });

    it('should include update', () => {
      expect(adminPerms).toContain('update');
    });

    it('should include delete', () => {
      expect(adminPerms).toContain('delete');
    });

    it('should include activate', () => {
      expect(adminPerms).toContain('activate');
    });

    it('should include bulk-import', () => {
      expect(adminPerms).toContain('bulk-import');
    });

    it('should include manage-credentials', () => {
      expect(adminPerms).toContain('manage-credentials');
    });
  });

  // =========================================================================
  describe('OPERATOR permissions', () => {
    const operatorPerms: Permission[] =
      ROLE_PERMISSIONS[UserRole.OPERATOR];

    it('should grant exactly 5 permissions', () => {
      expect(operatorPerms).toHaveLength(5);
    });

    it('should include read', () => {
      expect(operatorPerms).toContain('read');
    });

    it('should include create', () => {
      expect(operatorPerms).toContain('create');
    });

    it('should include update', () => {
      expect(operatorPerms).toContain('update');
    });

    it('should include activate', () => {
      expect(operatorPerms).toContain('activate');
    });

    it('should include bulk-import', () => {
      expect(operatorPerms).toContain('bulk-import');
    });

    it('should NOT include delete', () => {
      expect(operatorPerms).not.toContain('delete');
    });

    it('should NOT include manage-credentials', () => {
      expect(operatorPerms).not.toContain('manage-credentials');
    });
  });

  // =========================================================================
  describe('VIEWER permissions', () => {
    const viewerPerms: Permission[] =
      ROLE_PERMISSIONS[UserRole.VIEWER];

    it('should grant exactly 1 permission', () => {
      expect(viewerPerms).toHaveLength(1);
    });

    it('should include read', () => {
      expect(viewerPerms).toContain('read');
    });

    it('should NOT include create', () => {
      expect(viewerPerms).not.toContain('create');
    });

    it('should NOT include update', () => {
      expect(viewerPerms).not.toContain('update');
    });

    it('should NOT include delete', () => {
      expect(viewerPerms).not.toContain('delete');
    });

    it('should NOT include activate', () => {
      expect(viewerPerms).not.toContain('activate');
    });

    it('should NOT include bulk-import', () => {
      expect(viewerPerms).not.toContain('bulk-import');
    });
  });

  // =========================================================================
  describe('permission set completeness', () => {
    it('should define entries for all three roles', () => {
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.ADMIN);
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.OPERATOR);
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.VIEWER);
    });

    it('should not define entries for unknown roles', () => {
      expect(ROLE_PERMISSIONS['SUPERUSER']).toBeUndefined();
    });
  });
});
