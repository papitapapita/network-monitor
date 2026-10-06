import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';
import { UserProps } from '../props/UserProps';
import { UserSignInPausedEvent } from '../events/UserSignInPausedEvent';

// IDN-044: the first few wrong passwords cost nothing; from then on each one
// pauses sign-in for twice as long as the last, up to a cap. A pause that
// ended stays counted, so the next wrong password pauses for longer still.
export const FREE_FAILED_SIGN_INS = 5;
const FIRST_PAUSE_MS = 60_000;
const MAX_PAUSE_MS = 15 * 60_000;

export const SIGN_IN_PAUSED =
  'Sign-in is paused after too many failures';

export const RECOVERY_CODES_PER_SETUP = 10;
export const TWO_FACTOR_ALREADY_ON =
  'Two-factor sign-in is already on';
export const TWO_FACTOR_NOT_STARTED =
  'Two-factor setup has not been started';
export const TWO_FACTOR_OFF = 'Two-factor sign-in is not on';
export const CODE_ALREADY_USED = 'This code was already used';
export const RECOVERY_CODE_UNKNOWN = 'Unknown or used recovery code';

export function signInPauseAfter(failedSignIns: number): number {
  if (failedSignIns < FREE_FAILED_SIGN_INS) return 0;
  const doublings = failedSignIns - FREE_FAILED_SIGN_INS;
  return Math.min(
    FIRST_PAUSE_MS * 2 ** Math.min(doublings, 10),
    MAX_PAUSE_MS
  );
}

// Every change that should end the sessions a user already has open bumps
// tokenVersion; a token carrying an older version is refused (IDN-065).
export class User extends AggregateRoot<UserProps, UserId> {
  private constructor(props: UserProps, id: UserId) {
    super(props, id);
  }

  get email(): UserEmail {
    return this.props.email;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get disabledAt(): Date | null {
    return this.props.disabledAt;
  }

  get isDisabled(): boolean {
    return this.props.disabledAt !== null;
  }

  get tokenVersion(): number {
    return this.props.tokenVersion;
  }

  get failedSignIns(): number {
    return this.props.failedSignIns;
  }

  get signInPausedUntil(): Date | null {
    return this.props.signInPausedUntil;
  }

  get twoFactorSecret(): string | null {
    return this.props.twoFactorSecret;
  }

  get twoFactorEnabledAt(): Date | null {
    return this.props.twoFactorEnabledAt;
  }

  get hasTwoFactor(): boolean {
    return this.props.twoFactorEnabledAt !== null;
  }

  get twoFactorLastStep(): number | null {
    return this.props.twoFactorLastStep;
  }

  get recoveryCodeHashes(): string[] {
    return [...this.props.recoveryCodeHashes];
  }

  public isSignInPaused(now: Date): boolean {
    return (
      this.props.signInPausedUntil !== null &&
      now < this.props.signInPausedUntil
    );
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(props: {
    email: UserEmail;
    role: UserRole;
    passwordHash: string;
  }): Result<User> {
    const now = new Date();
    const full: UserProps = {
      email: props.email,
      role: props.role,
      passwordHash: props.passwordHash,
      disabledAt: null,
      tokenVersion: 0,
      failedSignIns: 0,
      signInPausedUntil: null,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastStep: null,
      recoveryCodeHashes: [],
      createdAt: now,
      updatedAt: now
    };
    const invalid = User.validate(full);
    if (invalid) {
      return Result.fail<User>(invalid);
    }
    return Result.ok<User>(new User(full, UserId.create()));
  }

  public changeRole(role: UserRole): Result<void> {
    return this.apply({ role }, true);
  }

  // A new password also lifts a sign-in pause: the failures were against
  // the old one (IDN-044).
  public changePassword(passwordHash: string): Result<void> {
    return this.apply(
      { passwordHash, failedSignIns: 0, signInPausedUntil: null },
      true
    );
  }

  public disable(): Result<void> {
    if (this.isDisabled) {
      return Result.fail<void>('User is already disabled');
    }
    return this.apply({ disabledAt: new Date() }, true);
  }

  public enable(): Result<void> {
    if (!this.isDisabled) {
      return Result.fail<void>('User is not disabled');
    }
    return this.apply({ disabledAt: null }, false);
  }

  // Refused while a pause runs, so attempts during it neither count nor
  // stretch it (IDN-044).
  public recordFailedSignIn(
    now: Date,
    sourceIp: string | null
  ): Result<void> {
    if (this.isSignInPaused(now)) {
      return Result.fail<void>(SIGN_IN_PAUSED);
    }
    const failedSignIns = this.props.failedSignIns + 1;
    const pauseMs = signInPauseAfter(failedSignIns);
    const signInPausedUntil =
      pauseMs > 0 ? new Date(now.getTime() + pauseMs) : null;
    const applied = this.apply(
      { failedSignIns, signInPausedUntil },
      false
    );
    if (applied.isFailure) return applied;

    // Only the first pause is announced (IDN-045): one message per run of
    // failures, not one per attempt.
    if (failedSignIns === FREE_FAILED_SIGN_INS && signInPausedUntil) {
      this.addDomainEvent(
        new UserSignInPausedEvent({
          aggregateId: this.id,
          email: this.props.email.toString(),
          failedSignIns,
          pausedUntil: signInPausedUntil,
          sourceIp,
          dateTimeOccurred: now
        })
      );
    }
    return applied;
  }

  public recordSuccessfulSignIn(): Result<void> {
    if (this.props.failedSignIns === 0) return Result.ok<void>();
    return this.apply(
      { failedSignIns: 0, signInPausedUntil: null },
      false
    );
  }

  // A new setup replaces one left unfinished, but never a working one: that
  // takes an administrator's reset (IDN-165).
  public startTwoFactorSetup(encryptedSecret: string): Result<void> {
    if (this.hasTwoFactor)
      return Result.fail<void>(TWO_FACTOR_ALREADY_ON);
    return this.apply(
      {
        twoFactorSecret: encryptedSecret,
        twoFactorLastStep: null,
        recoveryCodeHashes: []
      },
      false
    );
  }

  // The first valid code proves the app holds the secret (IDN-160).
  public confirmTwoFactor(
    step: number,
    recoveryCodeHashes: string[],
    now: Date
  ): Result<void> {
    if (this.hasTwoFactor)
      return Result.fail<void>(TWO_FACTOR_ALREADY_ON);
    if (this.props.twoFactorSecret === null) {
      return Result.fail<void>(TWO_FACTOR_NOT_STARTED);
    }
    return this.apply(
      {
        twoFactorEnabledAt: now,
        twoFactorLastStep: step,
        recoveryCodeHashes: [...recoveryCodeHashes]
      },
      false
    );
  }

  public acceptTwoFactorCode(step: number): Result<void> {
    if (!this.hasTwoFactor) return Result.fail<void>(TWO_FACTOR_OFF);
    const last = this.props.twoFactorLastStep;
    if (last !== null && step <= last) {
      return Result.fail<void>(CODE_ALREADY_USED);
    }
    return this.apply({ twoFactorLastStep: step }, false);
  }

  public useRecoveryCode(hash: string): Result<void> {
    if (!this.hasTwoFactor) return Result.fail<void>(TWO_FACTOR_OFF);
    const remaining = this.props.recoveryCodeHashes.filter(
      (h) => h !== hash
    );
    if (remaining.length === this.props.recoveryCodeHashes.length) {
      return Result.fail<void>(RECOVERY_CODE_UNKNOWN);
    }
    return this.apply({ recoveryCodeHashes: remaining }, false);
  }

  // Ends every session and remembered browser; the person sets two-factor
  // up again at their next sign-in (IDN-165).
  public resetTwoFactor(): Result<void> {
    if (this.props.twoFactorSecret === null) {
      return Result.fail<void>(TWO_FACTOR_OFF);
    }
    return this.apply(
      {
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorLastStep: null,
        recoveryCodeHashes: []
      },
      true
    );
  }

  public static reconstitute(id: UserId, props: UserProps): User {
    return new User(props, id);
  }

  private apply(
    changes: Partial<UserProps>,
    endSessions: boolean
  ): Result<void> {
    const next: UserProps = {
      ...this.props,
      ...changes,
      tokenVersion: this.props.tokenVersion + (endSessions ? 1 : 0),
      updatedAt: new Date()
    };
    const invalid = User.validate(next);
    if (invalid) {
      return Result.fail<void>(invalid);
    }
    this.props = next;
    return Result.ok<void>();
  }

  private static validate(props: UserProps): string | null {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.email, 'email'),
      Guard.againstNullOrUndefined(props.role, 'role'),
      Guard.againstNullOrUndefined(
        props.passwordHash,
        'passwordHash'
      ),
      Guard.isString(props.passwordHash, 'passwordHash')
    ]);
    if (!guardResult.succeeded) {
      return guardResult.message!;
    }

    if (props.passwordHash.trim().length === 0) {
      return 'passwordHash cannot be empty';
    }

    if (
      !Number.isInteger(props.tokenVersion) ||
      props.tokenVersion < 0
    ) {
      return 'tokenVersion must be a non-negative integer';
    }

    if (
      !Number.isInteger(props.failedSignIns) ||
      props.failedSignIns < 0
    ) {
      return 'failedSignIns must be a non-negative integer';
    }

    if (
      props.signInPausedUntil !== null &&
      props.failedSignIns < FREE_FAILED_SIGN_INS
    ) {
      return `Sign-in can only be paused after ${FREE_FAILED_SIGN_INS} failures`;
    }

    if (
      props.twoFactorEnabledAt !== null &&
      props.twoFactorSecret === null
    ) {
      return 'Two-factor sign-in cannot be on without a secret';
    }

    if (
      props.twoFactorEnabledAt === null &&
      (props.twoFactorLastStep !== null ||
        props.recoveryCodeHashes.length > 0)
    ) {
      return 'Codes are only kept while two-factor sign-in is on';
    }

    if (props.recoveryCodeHashes.length > RECOVERY_CODES_PER_SETUP) {
      return `At most ${RECOVERY_CODES_PER_SETUP} recovery codes`;
    }

    return null;
  }
}
