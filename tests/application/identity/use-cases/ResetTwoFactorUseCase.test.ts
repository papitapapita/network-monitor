// Source: src/application/identity/use-cases/ResetTwoFactorUseCase.ts

import { ResetTwoFactorUseCase } from '../../../../src/application/identity/use-cases/ResetTwoFactorUseCase';
import {
  ADMIN_RESET_NEEDS_VENDOR,
  VENDOR_ACCOUNT_PROTECTED
} from '../../../../src/application/identity/services/userAccountPolicy';
import {
  TWO_FACTOR_OFF,
  User
} from '../../../../src/domain/identity/aggregates/User';
import { Result } from '../../../../src/domain/shared/core/Result';
import { UserTwoFactorResetEvent } from '../../../../src/domain/identity/events/UserTwoFactorResetEvent';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';
import { withTwoFactor } from './twoFactorFakes';

const GHOST = '11111111-1111-4111-8111-111111111111';

describe('ResetTwoFactorUseCase', () => {
  let staff: User;
  let admin: User;
  let vendor: User;

  beforeEach(() => {
    staff = withTwoFactor(makeUser('OPERATOR', 'staff@isp.example'));
    admin = withTwoFactor(makeUser('ADMIN', 'admin@isp.example'));
    vendor = withTwoFactor(makeUser('VENDOR', 'vendor@nms.example'));
  });

  const run = (
    target: User | string,
    callerRole = 'ADMIN',
    callerEmail = 'boss@isp.example'
  ) => {
    const repo = makeUserRepo([staff, admin, vendor]);
    const useCase = new ResetTwoFactorUseCase(repo, makeLogger());
    const id =
      typeof target === 'string' ? target : target.id.toString();
    return {
      repo,
      result: useCase.execute({ id, callerRole, callerEmail })
    };
  };

  it('[IDN-172] an administrator resets a staff member and ends their sessions', async () => {
    const { repo, result } = run(staff);

    const account = (await result).value;

    expect(account.twoFactorEnabled).toBe(false);
    expect(staff.twoFactorSecret).toBeNull();
    expect(staff.tokenVersion).toBe(1);
    expect(repo.save).toHaveBeenCalledWith(staff);
  });

  it('[IDN-173] names the caller in the reset event', async () => {
    await run(staff, 'ADMIN', 'boss@isp.example').result;

    const event = staff.domainEvents.find(
      (e) => e instanceof UserTwoFactorResetEvent
    ) as UserTwoFactorResetEvent;
    expect(event.resetBy).toBe('boss@isp.example');
  });

  it('[IDN-172] an administrator cannot reset an administrator', async () => {
    const { repo, result } = run(admin, 'ADMIN');

    expect((await result).error).toBe(ADMIN_RESET_NEEDS_VENDOR);
    expect(admin.hasTwoFactor).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-172] the vendor resets an administrator', async () => {
    const { result } = run(admin, 'VENDOR', 'vendor@nms.example');

    expect((await result).isSuccess).toBe(true);
    expect(admin.hasTwoFactor).toBe(false);
  });

  it('[IDN-141] nobody resets the vendor account', async () => {
    const { result } = run(vendor, 'VENDOR', 'vendor@nms.example');

    expect((await result).error).toBe(VENDOR_ACCOUNT_PROTECTED);
    expect(vendor.hasTwoFactor).toBe(true);
  });

  it('[IDN-172] there is nothing to reset before setup starts', async () => {
    staff = makeUser('OPERATOR', 'staff@isp.example');

    expect((await run(staff).result).error).toBe(TWO_FACTOR_OFF);
  });

  it('[IDN-172] resets a setup that was started but never confirmed', async () => {
    staff = makeUser('OPERATOR', 'staff@isp.example');
    staff.startTwoFactorSetup('enc:HALF');

    expect((await run(staff).result).isSuccess).toBe(true);
    expect(staff.twoFactorSecret).toBeNull();
  });

  it('refuses an unknown user', async () => {
    expect((await run(GHOST).result).error).toMatch(/not found/);
  });

  it('refuses a malformed id', async () => {
    expect((await run('nope').result).error).toMatch(
      /Invalid user ID/
    );
  });

  it('fails when the reset cannot be saved', async () => {
    const { repo, result } = run(staff);
    repo.save.mockResolvedValueOnce(Result.fail<User>('db down'));

    expect((await result).isFailure).toBe(true);
  });
});
