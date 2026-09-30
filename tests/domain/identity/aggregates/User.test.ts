// Source: src/domain/identity/aggregates/User.ts

import { User } from '../../../../src/domain/identity/aggregates/User';
import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { UserId } from '../../../../src/domain/shared/ids/UserId';
import { UserProps } from '../../../../src/domain/identity/props/UserProps';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeEmail(raw = 'user@example.com'): UserEmail {
  return UserEmail.reconstitute(raw);
}

function makeRole(raw = 'OPERATOR'): UserRole {
  return UserRole.reconstitute(raw);
}

function makeValidCreateProps(
  overrides: Partial<{
    email: UserEmail;
    role: UserRole;
    passwordHash: string;
  }> = {}
): { email: UserEmail; role: UserRole; passwordHash: string } {
  return {
    email: makeEmail(),
    role: makeRole(),
    passwordHash: '$2b$10$hashedpassword',
    ...overrides
  };
}

function makeUserProps(
  overrides: Partial<UserProps> = {}
): UserProps {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    email: makeEmail(),
    role: makeRole(),
    passwordHash: '$2b$10$hashedpassword',
    disabledAt: null,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('User', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should return Result.ok with a User instance for valid props', () => {
        const result = User.create(makeValidCreateProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(User);
      });

      it('should generate a new UserId automatically', () => {
        const result = User.create(makeValidCreateProps());

        expect(result.value.id).toBeDefined();
        expect(result.value.id.toString()).toBeTruthy();
      });

      it('should expose the provided email through the email getter', () => {
        const email = makeEmail('alice@example.com');
        const result = User.create(makeValidCreateProps({ email }));

        expect(result.value.email.toString()).toBe(
          'alice@example.com'
        );
      });

      it('should expose the provided role through the role getter', () => {
        const role = makeRole('ADMIN');
        const result = User.create(makeValidCreateProps({ role }));

        expect(result.value.role.toString()).toBe('ADMIN');
      });

      it('should expose the provided passwordHash through the passwordHash getter', () => {
        const result = User.create(
          makeValidCreateProps({ passwordHash: '$2b$10$unique_hash' })
        );

        expect(result.value.passwordHash).toBe('$2b$10$unique_hash');
      });

      it('should set createdAt to the current time', () => {
        const before = new Date();
        const result = User.create(makeValidCreateProps());
        const after = new Date();

        expect(
          result.value.createdAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(result.value.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should set updatedAt equal to createdAt on creation', () => {
        const result = User.create(makeValidCreateProps());

        expect(result.value.updatedAt.getTime()).toBe(
          result.value.createdAt.getTime()
        );
      });

      it('should produce a unique id on each call', () => {
        const a = User.create(makeValidCreateProps());
        const b = User.create(makeValidCreateProps());

        expect(a.value.id.toString()).not.toBe(b.value.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('validation failures', () => {
      it('should return Result.fail when email is null', () => {
        const result = User.create(
          makeValidCreateProps({
            email: null as unknown as UserEmail
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });

      it('should return Result.fail when role is null', () => {
        const result = User.create(
          makeValidCreateProps({ role: null as unknown as UserRole })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('role');
      });

      it('should return Result.fail when passwordHash is null', () => {
        const result = User.create(
          makeValidCreateProps({
            passwordHash: null as unknown as string
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('passwordHash');
      });

      it('should return Result.fail when passwordHash is not a string', () => {
        const result = User.create(
          makeValidCreateProps({
            passwordHash: 42 as unknown as string
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('passwordHash');
      });

      it('should return Result.fail when passwordHash is an empty string', () => {
        const result = User.create(
          makeValidCreateProps({ passwordHash: '' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('passwordHash');
      });

      it('should return Result.fail when passwordHash is whitespace only', () => {
        const result = User.create(
          makeValidCreateProps({ passwordHash: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('passwordHash');
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a User instance with the provided id and props', () => {
      const id = UserId.create();
      const props = makeUserProps();

      const user = User.reconstitute(id, props);

      expect(user).toBeInstanceOf(User);
      expect(user.id.toString()).toBe(id.toString());
    });

    it('should expose email from the provided props', () => {
      const id = UserId.create();
      const props = makeUserProps({
        email: makeEmail('repo@example.com')
      });

      const user = User.reconstitute(id, props);

      expect(user.email.toString()).toBe('repo@example.com');
    });

    it('should expose role from the provided props', () => {
      const id = UserId.create();
      const props = makeUserProps({ role: makeRole('VIEWER') });

      const user = User.reconstitute(id, props);

      expect(user.role.toString()).toBe('VIEWER');
    });

    it('should expose passwordHash from the provided props', () => {
      const id = UserId.create();
      const props = makeUserProps({ passwordHash: '$2b$10$from_db' });

      const user = User.reconstitute(id, props);

      expect(user.passwordHash).toBe('$2b$10$from_db');
    });

    it('should expose createdAt from the provided props', () => {
      const id = UserId.create();
      const createdAt = new Date('2023-06-01T00:00:00.000Z');
      const props = makeUserProps({ createdAt });

      const user = User.reconstitute(id, props);

      expect(user.createdAt).toEqual(createdAt);
    });

    it('should not raise a domain event on reconstitute', () => {
      const id = UserId.create();
      const user = User.reconstitute(id, makeUserProps());

      expect(user.domainEvents).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('changeRole()', () => {
    it('[IDN-011] should replace the role and touch updatedAt', () => {
      const user = User.reconstitute(
        UserId.create(),
        makeUserProps()
      );
      const before = user.updatedAt;

      const result = user.changeRole(makeRole('VENDOR'));

      expect(result.isSuccess).toBe(true);
      expect(user.role.isVendor()).toBe(true);
      expect(user.updatedAt.getTime()).toBeGreaterThan(
        before.getTime()
      );
    });

    it('should keep the email and password hash', () => {
      const user = User.reconstitute(
        UserId.create(),
        makeUserProps()
      );

      user.changeRole(makeRole('VENDOR'));

      expect(user.email.toString()).toBe('user@example.com');
      expect(user.passwordHash).toBe('$2b$10$hashedpassword');
    });

    it('should refuse a missing role and leave the user unchanged', () => {
      const user = User.reconstitute(
        UserId.create(),
        makeUserProps()
      );

      const result = user.changeRole(
        undefined as unknown as UserRole
      );

      expect(result.isFailure).toBe(true);
      expect(user.role.toString()).toBe('OPERATOR');
    });
  });

  // =========================================================================
  describe('[IDN-065] sessions', () => {
    const fresh = () =>
      User.reconstitute(UserId.create(), makeUserProps());

    it('starts a created user at token version 0, enabled', () => {
      const user = User.create(makeValidCreateProps()).value;

      expect(user.tokenVersion).toBe(0);
      expect(user.isDisabled).toBe(false);
      expect(user.disabledAt).toBeNull();
    });

    it('bumps the token version on a role change', () => {
      const user = fresh();
      user.changeRole(makeRole('VIEWER'));
      expect(user.tokenVersion).toBe(1);
    });

    it('bumps the token version on a password change and stores the hash', () => {
      const user = fresh();
      user.changePassword('$2b$10$new');
      expect(user.tokenVersion).toBe(1);
      expect(user.passwordHash).toBe('$2b$10$new');
    });

    it('refuses an empty password hash and leaves the user unchanged', () => {
      const user = fresh();
      const result = user.changePassword('  ');
      expect(result.error).toBe('passwordHash cannot be empty');
      expect(user.tokenVersion).toBe(0);
    });
  });

  // =========================================================================
  describe('[IDN-013] disable() / enable()', () => {
    const fresh = () =>
      User.reconstitute(UserId.create(), makeUserProps());

    it('disables and ends the sessions', () => {
      const user = fresh();

      expect(user.disable().isSuccess).toBe(true);
      expect(user.isDisabled).toBe(true);
      expect(user.disabledAt).toBeInstanceOf(Date);
      expect(user.tokenVersion).toBe(1);
    });

    it('refuses to disable twice', () => {
      const user = fresh();
      user.disable();
      expect(user.disable().error).toBe('User is already disabled');
    });

    it('re-enables without touching the token version', () => {
      const user = fresh();
      user.disable();

      expect(user.enable().isSuccess).toBe(true);
      expect(user.isDisabled).toBe(false);
      expect(user.tokenVersion).toBe(1);
    });

    it('refuses to enable an enabled user', () => {
      expect(fresh().enable().error).toBe('User is not disabled');
    });
  });
});
