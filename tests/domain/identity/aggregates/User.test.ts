// Source: src/domain/identity/aggregates/User.ts

import {
  User,
  SIGN_IN_PAUSED,
  signInPauseAfter
} from '../../../../src/domain/identity/aggregates/User';
import { UserSignInPausedEvent } from '../../../../src/domain/identity/events/UserSignInPausedEvent';
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
    failedSignIns: 0,
    signInPausedUntil: null,
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

describe('User sign-in failures', () => {
  const at = new Date('2026-10-05T12:00:00.000Z');
  const later = (ms: number) => new Date(at.getTime() + ms);

  function user(overrides: Partial<UserProps> = {}): User {
    return User.reconstitute(
      UserId.create(),
      makeUserProps(overrides)
    );
  }

  function failTimes(u: User, n: number, now = at): void {
    for (let i = 0; i < n; i++)
      u.recordFailedSignIn(now, '203.0.113.7');
  }

  it('[IDN-044] counts the first four failures without pausing', () => {
    const u = user();
    failTimes(u, 4);

    expect(u.failedSignIns).toBe(4);
    expect(u.signInPausedUntil).toBeNull();
    expect(u.isSignInPaused(at)).toBe(false);
  });

  it('[IDN-044] pauses for one minute on the fifth failure', () => {
    const u = user();
    failTimes(u, 5);

    expect(u.signInPausedUntil).toEqual(later(60_000));
    expect(u.isSignInPaused(later(59_999))).toBe(true);
    expect(u.isSignInPaused(later(60_000))).toBe(false);
  });

  it('[IDN-044] doubles the pause with each failure after it, up to 15 minutes', () => {
    expect(signInPauseAfter(4)).toBe(0);
    expect(signInPauseAfter(5)).toBe(60_000);
    expect(signInPauseAfter(6)).toBe(120_000);
    expect(signInPauseAfter(8)).toBe(480_000);
    expect(signInPauseAfter(9)).toBe(900_000);
    expect(signInPauseAfter(500)).toBe(900_000);
  });

  it('[IDN-044] refuses a failure during a pause, so it neither counts nor stretches it', () => {
    const u = user();
    failTimes(u, 5);

    const result = u.recordFailedSignIn(later(30_000), null);

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect(u.failedSignIns).toBe(5);
    expect(u.signInPausedUntil).toEqual(later(60_000));
  });

  it('[IDN-044] pauses for longer on the first failure after a pause ends', () => {
    const u = user();
    failTimes(u, 5);

    u.recordFailedSignIn(later(60_000), null);

    expect(u.failedSignIns).toBe(6);
    expect(u.signInPausedUntil).toEqual(later(60_000 + 120_000));
  });

  it('[IDN-044] a successful sign-in clears the count and the pause', () => {
    const u = user({
      failedSignIns: 6,
      signInPausedUntil: null
    });

    u.recordSuccessfulSignIn();

    expect(u.failedSignIns).toBe(0);
    expect(u.signInPausedUntil).toBeNull();
  });

  it('[IDN-044] a new password lifts the pause and ends sessions', () => {
    const u = user();
    failTimes(u, 5);

    u.changePassword('$2b$10$fresh');

    expect(u.failedSignIns).toBe(0);
    expect(u.isSignInPaused(at)).toBe(false);
    expect(u.tokenVersion).toBe(1);
  });

  it('[IDN-044] does not end sessions or touch the version when counting', () => {
    const u = user();
    failTimes(u, 5);

    expect(u.tokenVersion).toBe(0);
  });

  it('[IDN-045] raises one pause event, on the fifth failure only', () => {
    const u = user();
    failTimes(u, 5);
    u.recordFailedSignIn(later(60_000), null);

    const events = u.domainEvents.filter(
      (e) => e instanceof UserSignInPausedEvent
    ) as UserSignInPausedEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].failedSignIns).toBe(5);
    expect(events[0].pausedUntil).toEqual(later(60_000));
    expect(events[0].sourceIp).toBe('203.0.113.7');
    expect(events[0].email).toBe(u.email.toString());
  });

  it('[IDN-044] refuses any change to a state paused before the free failures', () => {
    const u = user({ failedSignIns: 2, signInPausedUntil: later(1) });

    expect(u.changeRole(UserRole.reconstitute('ADMIN')).error).toBe(
      'Sign-in can only be paused after 5 failures'
    );
  });
});
