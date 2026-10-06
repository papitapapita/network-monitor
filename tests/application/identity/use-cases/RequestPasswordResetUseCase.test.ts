// Source: src/application/identity/use-cases/RequestPasswordResetUseCase.ts

import { RequestPasswordResetUseCase } from '../../../../src/application/identity/use-cases/RequestPasswordResetUseCase';
import { IEmailSender } from '../../../../src/application/shared/interfaces/IEmailSender';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';
import { makeTokens } from './twoFactorFakes';

describe('[IDN-182] RequestPasswordResetUseCase', () => {
  const build = (
    users: User[],
    appPublicUrl: string | null = 'https://app.isp.example'
  ) => {
    const repo = makeUserRepo(users);
    repo.findByEmail.mockImplementation(async (email) =>
      Result.ok<User | null>(
        users.find((u) => u.email.equals(email)) ?? null
      )
    );
    const sender: jest.Mocked<IEmailSender> = {
      send: jest.fn().mockResolvedValue(Result.ok<void>())
    };
    const logger = makeLogger();
    const useCase = new RequestPasswordResetUseCase(
      repo,
      makeTokens(),
      sender,
      appPublicUrl,
      logger
    );
    return { repo, sender, logger, useCase };
  };

  it('emails a one-hour link bound to the token version', async () => {
    const user = makeUser('OPERATOR', 'staff@isp.example');
    const { sender, useCase } = build([user]);

    const result = await useCase.execute({
      email: 'Staff@ISP.example'
    });

    expect(result.isSuccess).toBe(true);
    const [message] = sender.send.mock.calls[0];
    expect(message.to).toBe('staff@isp.example');
    expect(message.subject).toBe('Restablecer su contraseña');
    expect(message.text).toContain(
      `https://app.isp.example/reset-password#token=password-reset:${user.id.toString()}:0`
    );
  });

  it('answers the same, and sends nothing, for an unknown address', async () => {
    const { sender, useCase } = build([]);

    const result = await useCase.execute({
      email: 'nobody@isp.example'
    });

    expect(result.isSuccess).toBe(true);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('sends nothing to a disabled account', async () => {
    const user = makeUser();
    user.disable();
    const { sender, useCase } = build([user]);

    expect(
      (await useCase.execute({ email: 'staff@isp.example' }))
        .isSuccess
    ).toBe(true);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('sends nothing, and logs why, without APP_PUBLIC_URL', async () => {
    const { sender, logger, useCase } = build([makeUser()], null);

    expect(
      (await useCase.execute({ email: 'staff@isp.example' }))
        .isSuccess
    ).toBe(true);
    expect(sender.send).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('APP_PUBLIC_URL is not set'),
      expect.anything()
    );
  });

  it('answers the same when the email fails', async () => {
    const { sender, useCase } = build([makeUser()]);
    sender.send.mockResolvedValue(Result.fail<void>('smtp down'));

    expect(
      (await useCase.execute({ email: 'staff@isp.example' }))
        .isSuccess
    ).toBe(true);
  });

  it('reports a repository failure', async () => {
    const { repo, useCase } = build([]);
    repo.findByEmail.mockResolvedValue(
      Result.fail<User | null>('db down')
    );

    const result = await useCase.execute({
      email: 'staff@isp.example'
    });

    expect(result.error).toContain('db down');
  });
});
