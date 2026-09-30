import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';
import { UserProps } from '../props/UserProps';

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

  public changePassword(passwordHash: string): Result<void> {
    return this.apply({ passwordHash }, true);
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

    return null;
  }
}
