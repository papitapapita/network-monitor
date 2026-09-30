// Source: src/application/identity/use-cases/UpdateUserUseCase.ts

import { UpdateUserUseCase } from '../../../../src/application/identity/use-cases/UpdateUserUseCase';
import {
  OWN_ACCOUNT_REFUSED,
  PASSWORD_TOO_SHORT,
  VENDOR_ACCOUNT_PROTECTED,
  VENDOR_ROLE_NOT_ASSIGNABLE
} from '../../../../src/application/identity/services/userAccountPolicy';
import { UpdateUserRequestDTO } from '../../../../src/application/identity/dtos/UserManagementDTOs';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import {
  makePasswordService,
  makeUser,
  makeUserRepo
} from './userFixtures';

const GHOST = '11111111-1111-4111-8111-111111111111';

describe('UpdateUserUseCase', () => {
  let caller: User;
  let staff: User;
  let vendor: User;

  beforeEach(() => {
    caller = makeUser('ADMIN', 'admin@isp.example');
    staff = makeUser('OPERATOR', 'staff@isp.example');
    vendor = makeUser('VENDOR', 'vendor@nms.example');
  });

  const run = async (
    changes: Partial<UpdateUserRequestDTO>,
    target = staff
  ) => {
    const repo = makeUserRepo([caller, staff, vendor]);
    const useCase = new UpdateUserUseCase(
      repo,
      makePasswordService(),
      makeLogger()
    );
    const result = await useCase.execute({
      id: target.id.toString(),
      callerId: caller.id.toString(),
      ...changes
    });
    return { result, repo };
  };

  it('[IDN-140] changes the role and ends the sessions', async () => {
    const { result, repo } = await run({ role: 'VIEWER' });

    expect(result.value.role).toBe('VIEWER');
    expect(staff.tokenVersion).toBe(1);
    expect(repo.save).toHaveBeenCalledWith(staff);
  });

  it('[IDN-013] disables and re-enables', async () => {
    expect(
      (await run({ disabled: true })).result.value.disabled
    ).toBe(true);
    expect(
      (await run({ disabled: false })).result.value.disabled
    ).toBe(false);
  });

  it('treats the current state as a no-op', async () => {
    const { result } = await run({
      role: 'OPERATOR',
      disabled: false
    });

    expect(result.isSuccess).toBe(true);
    expect(staff.tokenVersion).toBe(0);
  });

  it('[IDN-140] resets the password', async () => {
    const { result } = await run({ password: 'new-password' });

    expect(result.isSuccess).toBe(true);
    expect(staff.passwordHash).toBe('hashed:new-password');
    expect(staff.tokenVersion).toBe(1);
  });

  it('applies several changes in one request', async () => {
    await run({ role: 'ADMIN', password: 'new-password' });

    expect(staff.role.toString()).toBe('ADMIN');
    expect(staff.passwordHash).toBe('hashed:new-password');
  });

  it('[IDN-141] refuses to touch the vendor account', async () => {
    const { result, repo } = await run({ disabled: true }, vendor);

    expect(result.error).toBe(VENDOR_ACCOUNT_PROTECTED);
    expect(vendor.isDisabled).toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-141] refuses to hand out the VENDOR role', async () => {
    const { result, repo } = await run({ role: 'VENDOR' });

    expect(result.error).toBe(VENDOR_ROLE_NOT_ASSIGNABLE);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-143] refuses changes to the caller’s own account', async () => {
    const { result } = await run({ role: 'VIEWER' }, caller);

    expect(result.error).toBe(OWN_ACCOUNT_REFUSED);
    expect(caller.role.toString()).toBe('ADMIN');
  });

  it('[IDN-142] refuses a short password without saving anything', async () => {
    const { result, repo } = await run({
      role: 'VIEWER',
      password: 'short'
    });

    expect(result.error).toBe(PASSWORD_TOO_SHORT);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('refuses an empty change', async () => {
    expect((await run({})).result.error).toBe('Nothing to update');
  });

  it('fails for an unknown user and a malformed id', async () => {
    const repo = makeUserRepo([caller]);
    const useCase = new UpdateUserUseCase(
      repo,
      makePasswordService(),
      makeLogger()
    );

    expect(
      (
        await useCase.execute({
          id: GHOST,
          callerId: caller.id.toString(),
          disabled: true
        })
      ).error
    ).toBe(`User not found: ${GHOST}`);
    expect(
      (
        await useCase.execute({
          id: 'nope',
          callerId: caller.id.toString(),
          disabled: true
        })
      ).error
    ).toBe('Invalid user ID: nope');
  });
});
