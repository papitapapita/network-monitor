// Source: src/domain/identity/permissions/Permission.ts

import {
  Permission,
  ROLE_PERMISSIONS
} from '../../../../src/domain/identity/permissions/Permission';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';

describe('ROLE_PERMISSIONS', () => {
  // =========================================================================
  describe('[IDN-030] VENDOR permissions', () => {
    const vendorPerms: Permission[] =
      ROLE_PERMISSIONS[UserRole.VENDOR];

    it('should grant everything ADMIN has', () => {
      expect(vendorPerms).toEqual(
        expect.arrayContaining(ROLE_PERMISSIONS[UserRole.ADMIN])
      );
    });

    it('should grant exactly 10 permissions', () => {
      expect(vendorPerms).toHaveLength(10);
    });

    it('should include manage-installation', () => {
      expect(vendorPerms).toContain('manage-installation');
    });
  });

  // =========================================================================
  describe('ADMIN permissions', () => {
    const adminPerms: Permission[] = ROLE_PERMISSIONS[UserRole.ADMIN];

    it('should grant exactly 9 permissions', () => {
      expect(adminPerms).toHaveLength(9);
    });

    it('[IDN-034] should include manage-settings', () => {
      expect(adminPerms).toContain('manage-settings');
    });

    it('[IDN-140] should include manage-users', () => {
      expect(adminPerms).toContain('manage-users');
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

    it('[IDN-033] should NOT include manage-installation', () => {
      expect(adminPerms).not.toContain('manage-installation');
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

    it('should NOT include manage-installation', () => {
      expect(operatorPerms).not.toContain('manage-installation');
    });

    it('should NOT include manage-users', () => {
      expect(operatorPerms).not.toContain('manage-users');
    });

    it('[IDN-034] should NOT include manage-settings', () => {
      expect(operatorPerms).not.toContain('manage-settings');
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
    it('should define entries for all four roles', () => {
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.VENDOR);
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.ADMIN);
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.OPERATOR);
      expect(ROLE_PERMISSIONS).toHaveProperty(UserRole.VIEWER);
    });

    it('should not define entries for unknown roles', () => {
      expect(ROLE_PERMISSIONS['SUPERUSER']).toBeUndefined();
    });
  });
});
