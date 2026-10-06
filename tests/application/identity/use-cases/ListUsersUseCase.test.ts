// Source: src/application/identity/use-cases/ListUsersUseCase.ts

import { ListUsersUseCase } from '../../../../src/application/identity/use-cases/ListUsersUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';

describe('[IDN-140] ListUsersUseCase', () => {
  const vendor = makeUser('VENDOR', 'vendor@nms.example');
  const admin = makeUser('ADMIN', 'admin@isp.example');
  const viewer = makeUser('VIEWER', 'viewer@isp.example');
  viewer.disable();

  const emails = async (callerRole: string) => {
    const useCase = new ListUsersUseCase(
      makeUserRepo([vendor, admin, viewer]),
      makeLogger()
    );
    const result = await useCase.execute({ callerRole });
    return result.value.users.map((u) => u.email);
  };

  it('hides the vendor account from the customer', async () => {
    expect(await emails('ADMIN')).toEqual([
      'admin@isp.example',
      'viewer@isp.example'
    ]);
  });

  it('shows it to the vendor', async () => {
    expect(await emails('VENDOR')).toContain('vendor@nms.example');
  });

  it('reports status and two-factor, never the password hash or secret', async () => {
    const useCase = new ListUsersUseCase(
      makeUserRepo([viewer]),
      makeLogger()
    );

    const [dto] = (await useCase.execute({ callerRole: 'ADMIN' }))
      .value.users;

    expect(dto).toEqual({
      id: viewer.id.toString(),
      email: 'viewer@isp.example',
      role: 'VIEWER',
      disabled: true,
      disabledAt: expect.any(String),
      twoFactorEnabled: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: expect.any(String)
    });
  });

  it('reports a repository failure', async () => {
    const repo = makeUserRepo();
    repo.findAll.mockResolvedValue(Result.fail<User[]>('db down'));

    const result = await new ListUsersUseCase(
      repo,
      makeLogger()
    ).execute({ callerRole: 'ADMIN' });

    expect(result.error).toContain('db down');
  });
});
