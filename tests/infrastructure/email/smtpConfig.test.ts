// Source: src/infrastructure/email/smtpConfig.ts

import { loadSmtpConfig } from '../../../src/infrastructure/email/smtpConfig';

describe('[IDN-180] loadSmtpConfig', () => {
  const full = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'secret',
    SMTP_FROM: 'Mi Red Control <no-reply@example.com>'
  };

  it('is null while SMTP_HOST is unset', () => {
    expect(loadSmtpConfig({})).toBeNull();
    expect(loadSmtpConfig({ SMTP_HOST: '  ' })).toBeNull();
  });

  it('reads the server, defaulting to port 587', () => {
    expect(loadSmtpConfig(full)).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: 'user',
      password: 'secret',
      from: 'Mi Red Control <no-reply@example.com>'
    });
    expect(loadSmtpConfig({ ...full, SMTP_PORT: '465' })?.port).toBe(
      465
    );
  });

  it('stops the boot on a bad port', () => {
    expect(() =>
      loadSmtpConfig({ ...full, SMTP_PORT: 'abc' })
    ).toThrow('SMTP_PORT is not a valid port');
  });

  it('stops the boot when a piece is missing', () => {
    expect(() =>
      loadSmtpConfig({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'u'
      })
    ).toThrow(
      'SMTP_HOST is set, so SMTP_PASSWORD, SMTP_FROM must be set too'
    );
  });
});
