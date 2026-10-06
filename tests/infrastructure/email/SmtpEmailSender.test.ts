// Source: src/infrastructure/email/SmtpEmailSender.ts

import { Transporter } from 'nodemailer';
import { SmtpEmailSender } from '../../../src/infrastructure/email/SmtpEmailSender';

describe('SmtpEmailSender', () => {
  const config = {
    host: 'smtp.example.com',
    port: 587,
    user: 'user',
    password: 'secret',
    from: 'no-reply@example.com'
  };
  const message = {
    to: 'a@isp.example',
    subject: 'Hola',
    text: 'Cuerpo'
  };

  const build = (sendMail: jest.Mock) =>
    new SmtpEmailSender(config, {
      sendMail
    } as unknown as Transporter);

  it('sends plain text from the configured address', async () => {
    const sendMail = jest.fn().mockResolvedValue({});

    const result = await build(sendMail).send(message);

    expect(result.isSuccess).toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'a@isp.example',
      subject: 'Hola',
      text: 'Cuerpo'
    });
  });

  it('turns a server error into a failure', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('535 auth'));

    const result = await build(sendMail).send(message);

    expect(result.error).toBe('Email not sent: 535 auth');
  });
});
