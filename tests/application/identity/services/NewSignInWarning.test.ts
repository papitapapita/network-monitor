// Source: src/application/identity/services/NewSignInWarning.ts

import { NewSignInWarning } from '../../../../src/application/identity/services/NewSignInWarning';
import { IEmailSender } from '../../../../src/application/shared/interfaces/IEmailSender';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser } from '../use-cases/userFixtures';

describe('[IDN-181] NewSignInWarning', () => {
  const user = makeUser('OPERATOR', 'staff@isp.example');
  const at = new Date('2026-10-05T19:30:00Z');

  const build = (send: IEmailSender['send']) => {
    const logger = makeLogger();
    const sender: jest.Mocked<IEmailSender> = { send: jest.fn(send) };
    return {
      sender,
      logger,
      warning: new NewSignInWarning(sender, logger)
    };
  };

  it('emails the account the time, in Colombia, and the address', async () => {
    const { sender, warning } = build(async () => Result.ok<void>());

    await warning.send(user, '203.0.113.7', at);

    const [message] = sender.send.mock.calls[0];
    expect(message.to).toBe('staff@isp.example');
    expect(message.subject).toBe(
      'Nuevo inicio de sesión en su cuenta'
    );
    expect(message.text).toContain('05/10/2026, 14:30');
    expect(message.text).toContain('desde la dirección 203.0.113.7');
  });

  it('says so when the address is unknown', async () => {
    const { sender, warning } = build(async () => Result.ok<void>());

    await warning.send(user, null, at);

    expect(sender.send.mock.calls[0][0].text).toContain(
      'desde una dirección desconocida'
    );
  });

  it('logs a failed send without throwing', async () => {
    const { logger, warning } = build(async () =>
      Result.fail<void>('smtp down')
    );

    await expect(
      warning.send(user, null, at)
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'NewSignInWarning: email not sent',
      { userId: user.id.toString(), error: 'smtp down' }
    );
  });

  it('logs a thrown error without throwing', async () => {
    const { logger, warning } = build(async () => {
      throw new Error('boom');
    });

    await expect(
      warning.send(user, null, at)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
