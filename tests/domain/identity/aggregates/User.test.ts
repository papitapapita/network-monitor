// Source: src/domain/identity/aggregates/User.ts

import {
  User,
  SIGN_IN_PAUSED,
  signInPauseAfter,
  TWO_FACTOR_NOT_STARTED,
  TWO_FACTOR_ALREADY_ON,
  TWO_FACTOR_OFF,
  CODE_ALREADY_USED,
  RECOVERY_CODE_UNKNOWN
} from '../../../../src/domain/identity/aggregates/User';
import { UserSignInPausedEvent } from '../../../../src/domain/identity/events/UserSignInPausedEvent';
import { UserTwoFactorResetEvent } from '../../../../src/domain/identity/events/UserTwoFactorResetEvent';
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
    twoFactorSecret: null,
    twoFactorEnabledAt: null,
    twoFactorLastStep: null,
    recoveryCodeHashes: [],
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

describe('User two-factor sign-in', () => {
  const at = new Date('2026-10-05T12:00:00.000Z');
  const HASHES = Array.from({ length: 10 }, (_, i) => `hash-${i}`);

  function user(overrides: Partial<UserProps> = {}): User {
    return User.reconstitute(
      UserId.create(),
      makeUserProps(overrides)
    );
  }

  function enrolled(): User {
    const u = user();
    u.startTwoFactorSetup('encrypted-secret');
    u.confirmTwoFactor(100, HASHES, at);
    return u;
  }

  it('[IDN-160] starts with two-factor off', () => {
    const u = user();

    expect(u.hasTwoFactor).toBe(false);
    expect(u.twoFactorSecret).toBeNull();
  });

  it('[IDN-160] keeps a started setup off until its first code', () => {
    const u = user();
    u.startTwoFactorSetup('encrypted-secret');

    expect(u.twoFactorSecret).toBe('encrypted-secret');
    expect(u.hasTwoFactor).toBe(false);
  });

  it('[IDN-160] turns on with the first code and the recovery codes', () => {
    const u = enrolled();

    expect(u.hasTwoFactor).toBe(true);
    expect(u.twoFactorEnabledAt).toEqual(at);
    expect(u.twoFactorLastStep).toBe(100);
    expect(u.recoveryCodeHashes).toEqual(HASHES);
  });

  it('[IDN-160] cannot confirm a setup that was never started', () => {
    expect(user().confirmTwoFactor(1, HASHES, at).error).toBe(
      TWO_FACTOR_NOT_STARTED
    );
  });

  it('[IDN-165] a new setup replaces an unfinished one', () => {
    const u = user();
    u.startTwoFactorSetup('first');

    expect(u.startTwoFactorSetup('second').isSuccess).toBe(true);
    expect(u.twoFactorSecret).toBe('second');
  });

  it('[IDN-165] a working setup cannot be replaced by starting again', () => {
    const u = enrolled();

    expect(u.startTwoFactorSetup('other').error).toBe(
      TWO_FACTOR_ALREADY_ON
    );
    expect(u.twoFactorSecret).toBe('encrypted-secret');
  });

  it('[IDN-164] accepts a code from a later step', () => {
    const u = enrolled();

    expect(u.acceptTwoFactorCode(101).isSuccess).toBe(true);
    expect(u.twoFactorLastStep).toBe(101);
  });

  it('[IDN-164] refuses a code from the same or an earlier step', () => {
    const u = enrolled();

    expect(u.acceptTwoFactorCode(100).error).toBe(CODE_ALREADY_USED);
    expect(u.acceptTwoFactorCode(99).error).toBe(CODE_ALREADY_USED);
    expect(u.twoFactorLastStep).toBe(100);
  });

  it('[IDN-160] refuses a code while two-factor is off', () => {
    expect(user().acceptTwoFactorCode(1).error).toBe(TWO_FACTOR_OFF);
  });

  it('[IDN-163] a recovery code works once', () => {
    const u = enrolled();

    expect(u.useRecoveryCode('hash-3').isSuccess).toBe(true);
    expect(u.recoveryCodeHashes).toHaveLength(9);
    expect(u.useRecoveryCode('hash-3').error).toBe(
      RECOVERY_CODE_UNKNOWN
    );
  });

  it('[IDN-163] refuses an unknown recovery code', () => {
    expect(enrolled().useRecoveryCode('nope').error).toBe(
      RECOVERY_CODE_UNKNOWN
    );
  });

  it('[IDN-165] a reset clears everything and ends sessions', () => {
    const u = enrolled();

    u.resetTwoFactor('admin@isp.example', new Date());

    expect(u.hasTwoFactor).toBe(false);
    expect(u.twoFactorSecret).toBeNull();
    expect(u.twoFactorLastStep).toBeNull();
    expect(u.recoveryCodeHashes).toEqual([]);
    expect(u.tokenVersion).toBe(1);
  });

  it('[IDN-165] there is nothing to reset before setup starts', () => {
    const u = user();

    expect(
      u.resetTwoFactor('admin@isp.example', new Date()).error
    ).toBe(TWO_FACTOR_OFF);
    expect(u.domainEvents).toHaveLength(0);
  });

  it('[IDN-173] a reset announces who reset which account', () => {
    const u = enrolled();
    const at = new Date('2026-10-05T12:00:00.000Z');

    u.resetTwoFactor('admin@isp.example', at);

    const events = u.domainEvents.filter(
      (e) => e instanceof UserTwoFactorResetEvent
    ) as UserTwoFactorResetEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].email).toBe(u.email.toString());
    expect(events[0].resetBy).toBe('admin@isp.example');
    expect(events[0].dateTimeOccurred).toBe(at);
  });

  it('[IDN-160] using codes does not end sessions', () => {
    const u = enrolled();
    u.acceptTwoFactorCode(101);
    u.useRecoveryCode('hash-0');

    expect(u.tokenVersion).toBe(0);
  });

  it.each<[string, Partial<UserProps>, string]>([
    [
      'on without a secret',
      { twoFactorEnabledAt: at, twoFactorSecret: null },
      'Two-factor sign-in cannot be on without a secret'
    ],
    [
      'recovery codes while off',
      { twoFactorSecret: 's', recoveryCodeHashes: ['h'] },
      'Codes are only kept while two-factor sign-in is on'
    ],
    [
      'more than ten recovery codes',
      {
        twoFactorSecret: 's',
        twoFactorEnabledAt: at,
        recoveryCodeHashes: Array.from(
          { length: 11 },
          (_, i) => `h${i}`
        )
      },
      'At most 10 recovery codes'
    ]
  ])(
    '[IDN-160] refuses a change to a state with %s',
    (_, props, message) => {
      expect(
        user(props).changeRole(UserRole.reconstitute('ADMIN')).error
      ).toBe(message);
    }
  );
});
