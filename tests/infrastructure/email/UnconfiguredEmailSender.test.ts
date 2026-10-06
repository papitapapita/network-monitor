// Source: src/infrastructure/email/UnconfiguredEmailSender.ts

import {
  EMAIL_NOT_CONFIGURED,
  UnconfiguredEmailSender
} from '../../../src/infrastructure/email/UnconfiguredEmailSender';
import { makeLogger } from '../../application/probe-agents/fixtures';

describe('[IDN-180] UnconfiguredEmailSender', () => {
  it('fails and logs the recipient and subject, never the body', async () => {
    const logger = makeLogger();

    const result = await new UnconfiguredEmailSender(logger).send({
      to: 'a@isp.example',
      subject: 'Hola',
      text: 'https://app.example.com/reset?token=secret'
    });

    expect(result.error).toBe(EMAIL_NOT_CONFIGURED);
    expect(logger.warn).toHaveBeenCalledWith(
      'Email not sent: SMTP_HOST is not set',
      { to: 'a@isp.example', subject: 'Hola' }
    );
  });
});
