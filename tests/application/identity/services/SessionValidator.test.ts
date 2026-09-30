// Source: src/application/identity/services/SessionValidator.ts

import {
  INVALID_SESSION,
  SessionValidator
} from '../../../../src/application/identity/services/SessionValidator';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { makeUser, makeUserRepo } from '../use-cases/userFixtures';

describe('[IDN-065] SessionValidator', () => {
  const payloadFor = (
    user: User,
    tokenVersion = user.tokenVersion
  ) => ({
    userId: user.id.toString(),
    email: 'stale@isp.example',
    role: 'VIEWER',
    tokenVersion
  });

  it('returns the account as it is now', async () => {
    const user = makeUser('OPERATOR', 'staff@isp.example');
    user.changeRole(UserRole.reconstitute('ADMIN'));
    const validator = new SessionValidator(makeUserRepo([user]));

    const result = await validator.validate(payloadFor(user));

    expect(result.value).toEqual({
      userId: user.id.toString(),
      email: 'staff@isp.example',
      role: 'ADMIN'
    });
  });

  it('refuses a token older than the account', async () => {
    const user = makeUser();
    user.changePassword('$2b$10$new');
    const validator = new SessionValidator(makeUserRepo([user]));

    const result = await validator.validate(payloadFor(user, 0));

    expect(result.error).toBe(INVALID_SESSION);
  });

  it('[IDN-013] refuses a disabled account', async () => {
    const user = makeUser();
    user.disable();
    const validator = new SessionValidator(makeUserRepo([user]));

    expect((await validator.validate(payloadFor(user))).error).toBe(
      INVALID_SESSION
    );
  });

  it('refuses an account that no longer exists', async () => {
    const validator = new SessionValidator(makeUserRepo([]));

    expect(
      (await validator.validate(payloadFor(makeUser()))).error
    ).toBe(INVALID_SESSION);
  });

  it('refuses a malformed user id', async () => {
    const validator = new SessionValidator(makeUserRepo([]));

    const result = await validator.validate({
      userId: 'nope',
      email: 'x@y.z',
      role: 'ADMIN',
      tokenVersion: 0
    });

    expect(result.error).toBe(INVALID_SESSION);
  });

  it('reports a repository failure as something other than a bad token', async () => {
    const repo = makeUserRepo();
    repo.findById.mockResolvedValue(
      Result.fail<User | null>('db down')
    );

    const result = await new SessionValidator(repo).validate(
      payloadFor(makeUser())
    );

    expect(result.error).toBe('Failed to check session: db down');
  });
});
