// Source: src/domain/notifications/entities/PushSubscription.ts

import {
  PushSubscription,
  PushSubscriptionInput
} from '../../../../src/domain/notifications/entities/PushSubscription';

function makeInput(
  overrides: Partial<PushSubscriptionInput> = {}
): PushSubscriptionInput {
  return {
    userId: '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    ...overrides
  };
}

describe('PushSubscription', () => {
  describe('create', () => {
    it('[NOT-220] accepts a browser subscription', () => {
      const result = PushSubscription.create(makeInput());

      expect(result.isSuccess).toBe(true);
      expect(result.value.endpoint).toBe(
        'https://fcm.googleapis.com/fcm/send/abc123'
      );
      expect(result.value.userAgent).toBe(
        'Mozilla/5.0 (Linux; Android 14)'
      );
    });

    it('trims every field', () => {
      const result = PushSubscription.create(
        makeInput({
          endpoint: '  https://push.example.com/x  ',
          auth: ' tBHItJI5svbpez7KI4CCXg '
        })
      );

      expect(result.value.endpoint).toBe(
        'https://push.example.com/x'
      );
      expect(result.value.auth).toBe('tBHItJI5svbpez7KI4CCXg');
    });

    it('[NOT-220] refuses an endpoint that is not https', () => {
      const result = PushSubscription.create(
        makeInput({ endpoint: 'http://169.254.169.254/latest' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('endpoint must be an https URL');
    });

    it('refuses an endpoint that is not a URL', () => {
      const result = PushSubscription.create(
        makeInput({ endpoint: 'not a url' })
      );

      expect(result.error).toBe('endpoint must be an https URL');
    });

    it('refuses an endpoint longer than 2048 characters', () => {
      const result = PushSubscription.create(
        makeInput({
          endpoint: `https://push.example.com/${'a'.repeat(2048)}`
        })
      );

      expect(result.error).toMatch(/at most 2048/);
    });

    it('refuses a key that is not base64url', () => {
      const result = PushSubscription.create(
        makeInput({ p256dh: 'not/base64+url' })
      );

      expect(result.error).toMatch(/^p256dh must be a base64url key/);
    });

    it('refuses an empty auth key', () => {
      const result = PushSubscription.create(
        makeInput({ auth: '  ' })
      );

      expect(result.error).toBe('auth is required');
    });

    it('refuses a missing user', () => {
      const result = PushSubscription.create(
        makeInput({ userId: '' })
      );

      expect(result.error).toBe('userId is required');
    });

    it('refuses missing fields without throwing', () => {
      const result = PushSubscription.create(
        {} as PushSubscriptionInput
      );

      expect(result.isFailure).toBe(true);
    });

    it('cuts the user agent to 255 characters and treats blank as none', () => {
      const long = PushSubscription.create(
        makeInput({ userAgent: 'x'.repeat(400) })
      );
      const blank = PushSubscription.create(
        makeInput({ userAgent: '  ' })
      );

      expect(long.value.userAgent).toHaveLength(255);
      expect(blank.value.userAgent).toBeNull();
    });
  });
});
