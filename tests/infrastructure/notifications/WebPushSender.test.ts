// Source: src/infrastructure/notifications/WebPushSender.ts

import webpush, { WebPushError } from 'web-push';
import { WebPushSender } from '../../../src/infrastructure/notifications/WebPushSender';
import { PushPayload } from '../../../src/application/notifications/interfaces';

jest.mock('web-push', () => {
  const actual = jest.requireActual('web-push');
  return {
    __esModule: true,
    default: { sendNotification: jest.fn() },
    WebPushError: actual.WebPushError
  };
});

const sendNotification = webpush.sendNotification as jest.Mock;

const CONFIG = {
  publicKey: 'BPublicKey',
  privateKey: 'privateKey',
  subject: 'mailto:ops@example.com'
};
const TARGET = {
  endpoint: 'https://push.example.com/a',
  p256dh: 'BNcRdre',
  auth: 'tBHItJI'
};
const PAYLOAD: PushPayload = {
  title: '🔴 Torre Norte caída',
  body: '',
  url: '/devices/1',
  tag: 'device_unreachable:1',
  urgent: true
};

function pushError(statusCode: number): WebPushError {
  return new WebPushError(
    'failed',
    statusCode,
    {},
    'body',
    TARGET.endpoint
  );
}

describe('WebPushSender', () => {
  beforeEach(() => sendNotification.mockReset());

  it('sends the payload as JSON, signed with the VAPID keys', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const sender = new WebPushSender(CONFIG);

    const result = await sender.send(TARGET, PAYLOAD);

    expect(result.value).toBe('delivered');
    const [subscription, body, options] =
      sendNotification.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: TARGET.endpoint,
      keys: { p256dh: TARGET.p256dh, auth: TARGET.auth }
    });
    expect(JSON.parse(body)).toEqual(PAYLOAD);
    expect(options).toMatchObject({
      vapidDetails: CONFIG,
      TTL: 86400,
      urgency: 'high'
    });
  });

  it('sends a resolved alert at normal urgency', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });

    await new WebPushSender(CONFIG).send(TARGET, {
      ...PAYLOAD,
      urgent: false
    });

    expect(sendNotification.mock.calls[0][2].urgency).toBe('normal');
  });

  it.each([404, 410])(
    '[NOT-224] reports a %i as gone',
    async (statusCode) => {
      sendNotification.mockRejectedValue(pushError(statusCode));

      const result = await new WebPushSender(CONFIG).send(
        TARGET,
        PAYLOAD
      );

      expect(result.value).toBe('gone');
    }
  );

  it('fails on any other push service error', async () => {
    sendNotification.mockRejectedValue(pushError(500));

    const result = await new WebPushSender(CONFIG).send(
      TARGET,
      PAYLOAD
    );

    expect(result.error).toBe('Push service error 500: body');
  });

  it('fails on a network error', async () => {
    sendNotification.mockRejectedValue(new Error('ECONNRESET'));

    const result = await new WebPushSender(CONFIG).send(
      TARGET,
      PAYLOAD
    );

    expect(result.error).toBe('Network error: ECONNRESET');
  });
});
