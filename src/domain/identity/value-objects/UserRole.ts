import { ValueObject, Result, Guard } from 'domain/shared/core';

interface UserRoleProps {
  value: string;
}

export class UserRole extends ValueObject<UserRoleProps> {
  static readonly ADMIN = 'ADMIN';
  static readonly OPERATOR = 'OPERATOR';
  static readonly VIEWER = 'VIEWER';

  private static readonly VALID_ROLES = [
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.VIEWER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: UserRoleProps) {
    super(props);
  }

  public static create(role: string): Result<UserRole> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(role, 'role'),
      Guard.isString(role, 'role')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<UserRole>(guardResult.message!);
    }

    const normalized = role.trim().toUpperCase();

    if (!UserRole.isValid(normalized)) {
      return Result.fail<UserRole>(
        `Invalid role: ${role}. Must be one of: ${UserRole.VALID_ROLES.join(', ')}`
      );
    }

    return Result.ok<UserRole>(new UserRole({ value: normalized }));
  }

  public static reconstitute(role: string): UserRole {
    return new UserRole({ value: role });
  }

  private static isValid(value: string): boolean {
    return UserRole.VALID_ROLES.includes(
      value as (typeof UserRole.VALID_ROLES)[number]
    );
  }

  public isAdmin(): boolean {
    return this._props.value === UserRole.ADMIN;
  }

  public isOperator(): boolean {
    return this._props.value === UserRole.OPERATOR;
  }

  public isViewer(): boolean {
    return this._props.value === UserRole.VIEWER;
  }

  public toString(): string {
    return this._props.value;
  }
}
