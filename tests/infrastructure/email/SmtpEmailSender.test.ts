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

  it('[BIL-320] attaches files when the message carries them', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const pdf = Buffer.from('%PDF-1.4');

    await build(sendMail).send({
      ...message,
      attachments: [
        {
          filename: 'cuenta.pdf',
          content: pdf,
          contentType: 'application/pdf'
        }
      ]
    });

    expect(sendMail.mock.calls[0][0].attachments).toEqual([
      {
        filename: 'cuenta.pdf',
        content: pdf,
        contentType: 'application/pdf'
      }
    ]);
  });

  it('turns a server error into a failure', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValue(new Error('535 auth'));

    const result = await build(sendMail).send(message);

    expect(result.error).toBe('Email not sent: 535 auth');
  });
});
