import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { UserEmail } from '../value-objects/UserEmail';
import { UserRole } from '../value-objects/UserRole';
import { UserProps } from '../props/UserProps';

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
    const invalid = User.validate(props);
    if (invalid) {
      return Result.fail<User>(invalid);
    }

    const id = UserId.create();
    const now = new Date();

    return Result.ok<User>(
      new User(
        {
          email: props.email,
          role: props.role,
          passwordHash: props.passwordHash,
          createdAt: now,
          updatedAt: now
        },
        id
      )
    );
  }

  public changeRole(role: UserRole): Result<void> {
    const invalid = User.validate({ ...this.props, role });
    if (invalid) {
      return Result.fail<void>(invalid);
    }
    this.props.role = role;
    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  public static reconstitute(id: UserId, props: UserProps): User {
    return new User(props, id);
  }

  private static validate(props: {
    email: UserEmail;
    role: UserRole;
    passwordHash: string;
  }): string | null {
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

    return null;
  }
}
