import { Result } from 'domain/shared/core';
import { User, UserRole } from 'domain/identity';

export const USER_PASSWORD_MIN_LENGTH = 12;
export const VENDOR_ACCOUNT_PROTECTED =
  'The vendor account is managed by the vendor';
export const VENDOR_ROLE_NOT_ASSIGNABLE =
  'The VENDOR role cannot be assigned through the API';
export const OWN_ACCOUNT_REFUSED =
  'You cannot change your own account here — use /api/users/me/password for your password';
export const PASSWORD_TOO_SHORT = `Password must be at least ${USER_PASSWORD_MIN_LENGTH} characters`;

// A role the API may hand out: any but VENDOR, which only the boot sets
// (IDN-011, IDN-141).
export function assignableRole(raw: string): Result<UserRole> {
  const role = UserRole.create(raw);
  if (role.isFailure) return role;
  if (role.value.isVendor()) {
    return Result.fail(VENDOR_ROLE_NOT_ASSIGNABLE);
  }
  return role;
}

export function checkPassword(
  password: string,
  minLength = USER_PASSWORD_MIN_LENGTH
): string | null {
  return password.length >= minLength
    ? null
    : `Password must be at least ${minLength} characters`;
}

export function isVendorAccount(user: User): boolean {
  return user.role.isVendor();
}

// Keeps passwords out of the request the base UseCase logs.
export function withoutPasswords(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const safe = { ...(data as Record<string, unknown>) };
  for (const key of ['password', 'currentPassword', 'newPassword']) {
    if (key in safe) delete safe[key];
  }
  return safe;
}
