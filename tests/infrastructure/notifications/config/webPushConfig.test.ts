// Source: src/infrastructure/notifications/config/webPushConfig.ts

import { loadWebPushConfig } from '../../../../src/infrastructure/notifications/config/webPushConfig';

const KEYS = {
  VAPID_PUBLIC_KEY: 'BPublicKey',
  VAPID_PRIVATE_KEY: 'privateKey'
};

describe('loadWebPushConfig', () => {
  it('[NOT-228] is off when neither key is set', () => {
    expect(loadWebPushConfig({}, null)).toBeNull();
  });

  it('[NOT-228] refuses one key without the other', () => {
    expect(() =>
      loadWebPushConfig({ VAPID_PUBLIC_KEY: 'BPublicKey' }, null)
    ).toThrow(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together'
    );
  });

  it('uses VAPID_SUBJECT when given', () => {
    expect(
      loadWebPushConfig(
        { ...KEYS, VAPID_SUBJECT: 'mailto:ops@example.com' },
        'https://app.example.com'
      )
    ).toEqual({
      publicKey: 'BPublicKey',
      privateKey: 'privateKey',
      subject: 'mailto:ops@example.com'
    });
  });

  it('falls back to APP_PUBLIC_URL for the subject', () => {
    expect(
      loadWebPushConfig(KEYS, 'https://app.example.com')?.subject
    ).toBe('https://app.example.com');
  });

  it('[NOT-228] refuses a subject the push services would reject', () => {
    expect(() =>
      loadWebPushConfig(KEYS, 'http://192.168.1.10')
    ).toThrow(/VAPID_SUBJECT must be a mailto: or https:\/\//);
    expect(() => loadWebPushConfig(KEYS, null)).toThrow(
      /VAPID_SUBJECT/
    );
  });
});
