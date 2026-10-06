// Source: src/application/identity/use-cases/CreateUserUseCase.ts

import {
  CreateUserUseCase,
  EMAIL_TAKEN,
  INVITATION_NOT_SENT
} from '../../../../src/application/identity/use-cases/CreateUserUseCase';
import { IEmailSender } from '../../../../src/application/shared/interfaces/IEmailSender';
import { makeTokens } from './twoFactorFakes';
import {
  PASSWORD_TOO_SHORT,
  VENDOR_ROLE_NOT_ASSIGNABLE
} from '../../../../src/application/identity/services/userAccountPolicy';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import {
  makePasswordService,
  makeUser,
  makeUserRepo
} from './userFixtures';

describe('CreateUserUseCase', () => {
  const build = (
    appPublicUrl: string | null = 'https://app.isp.example'
  ) => {
    const repo = makeUserRepo();
    repo.findByEmail.mockResolvedValue(Result.ok<User | null>(null));
    const logger = makeLogger();
    const sender: jest.Mocked<IEmailSender> = {
      send: jest.fn().mockResolvedValue(Result.ok<void>())
    };
    const useCase = new CreateUserUseCase(
      repo,
      makePasswordService(),
      makeTokens(),
      sender,
      appPublicUrl,
      logger
    );
    return { useCase, repo, logger, sender };
  };

  describe('[IDN-184] without a password', () => {
    const invite = (useCase: CreateUserUseCase) =>
      useCase.execute({
        email: 'New@ISP.example',
        password: null,
        role: 'VIEWER'
      });

    it('emails a seven-day link, then saves an account nobody knows the password of', async () => {
      const { useCase, repo, sender } = build();

      const result = await invite(useCase);

      expect(result.value).toMatchObject({
        email: 'new@isp.example',
        role: 'VIEWER',
        disabled: false
      });
      const saved = repo.save.mock.calls[0][0];
      expect(saved.passwordHash).toBe('hashed:unusable');
      const [message] = sender.send.mock.calls[0];
      expect(message.to).toBe('new@isp.example');
      expect(message.subject).toBe('Su cuenta está lista');
      expect(message.text).toContain(
        `https://app.isp.example/accept-invitation#token=invitation:${saved.id.toString()}:0`
      );
    });

    it('saves nothing when the email fails', async () => {
      const { useCase, repo, sender } = build();
      sender.send.mockResolvedValue(Result.fail<void>('smtp down'));

      expect((await invite(useCase)).error).toBe(INVITATION_NOT_SENT);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('sends and saves nothing without APP_PUBLIC_URL', async () => {
      const { useCase, repo, sender } = build(null);

      expect((await invite(useCase)).error).toBe(INVITATION_NOT_SENT);
      expect(sender.send).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('[IDN-004] emails nobody when the address already has an account', async () => {
      const { useCase, repo, sender } = build();
      repo.findByEmail.mockResolvedValue(
        Result.ok<User | null>(makeUser('VIEWER', 'new@isp.example'))
      );

      expect((await invite(useCase)).error).toBe(EMAIL_TAKEN);
      expect(sender.send).not.toHaveBeenCalled();
    });

    it('[IDN-141] refuses the VENDOR role before any email', async () => {
      const { useCase, sender } = build();

      const result = await useCase.execute({
        email: 'new@isp.example',
        password: null,
        role: 'VENDOR'
      });

      expect(result.isFailure).toBe(true);
      expect(sender.send).not.toHaveBeenCalled();
    });
  });

  it('[IDN-140] creates an enabled account with the hashed password', async () => {
    const { useCase, repo } = build();

    const result = await useCase.execute({
      email: 'New@ISP.example',
      password: 'twelve-chars',
      role: 'operator'
    });

    expect(result.value).toMatchObject({
      email: 'new@isp.example',
      role: 'OPERATOR',
      disabled: false
    });
    expect(repo.save.mock.calls[0][0].passwordHash).toBe(
      'hashed:twelve-chars'
    );
  });

  it('[IDN-141] refuses the VENDOR role', async () => {
    const { useCase, repo } = build();

    const result = await useCase.execute({
      email: 'new@isp.example',
      password: 'long-enough-pass',
      role: 'VENDOR'
    });

    expect(result.error).toBe(VENDOR_ROLE_NOT_ASSIGNABLE);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-142] refuses a password under 12 characters', async () => {
    const { useCase } = build();

    const result = await useCase.execute({
      email: 'new@isp.example',
      password: 'eleven-char',
      role: 'VIEWER'
    });

    expect(result.error).toBe(PASSWORD_TOO_SHORT);
  });

  it('refuses a malformed email and an unknown role', async () => {
    const { useCase } = build();

    expect(
      (
        await useCase.execute({
          email: 'nope',
          password: 'long-enough-pass',
          role: 'VIEWER'
        })
      ).error
    ).toBe('Email is not valid');
    expect(
      (
        await useCase.execute({
          email: 'a@b.co',
          password: 'long-enough-pass',
          role: 'ROOT'
        })
      ).error
    ).toContain('Invalid role');
  });

  it('[IDN-004] passes on a duplicate email', async () => {
    const { useCase, repo } = build();
    repo.save.mockResolvedValue(
      Result.fail<User>('A user with this email already exists')
    );

    const result = await useCase.execute({
      email: 'taken@isp.example',
      password: 'long-enough-pass',
      role: 'VIEWER'
    });

    expect(result.error).toBe(
      'A user with this email already exists'
    );
  });

  it('never logs the password', async () => {
    const { useCase, logger } = build();

    await useCase.execute({
      email: 'new@isp.example',
      password: 'super-secret-pass',
      role: 'VIEWER'
    });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'super-secret-pass'
    );
  });
});
