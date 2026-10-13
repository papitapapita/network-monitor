// Source: src/application/notifications/use-cases/SubscribePushUseCase.ts,
// UnsubscribePushUseCase.ts, SendTestPushUseCase.ts, SendPushAlertUseCase.ts,
// src/application/notifications/shared/PushDelivery.ts

import { SubscribePushUseCase } from '../../../../src/application/notifications/use-cases/SubscribePushUseCase';
import { UnsubscribePushUseCase } from '../../../../src/application/notifications/use-cases/UnsubscribePushUseCase';
import {
  SendTestPushUseCase,
  NO_PUSH_SUBSCRIPTION,
  TEST_PUSH_NOT_DELIVERED
} from '../../../../src/application/notifications/use-cases/SendTestPushUseCase';
import { SendPushAlertUseCase } from '../../../../src/application/notifications/use-cases/SendPushAlertUseCase';
import { SendPushAlertDTO } from '../../../../src/application/notifications/dtos/SendPushAlertDTO';
import { IPushSubscriptionRepository } from '../../../../src/domain/notifications/repository/IPushSubscriptionRepository';
import { PushSubscription } from '../../../../src/domain/notifications/entities/PushSubscription';
import { IPushSender } from '../../../../src/application/notifications/interfaces/IPushSender';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { AlertSeverity } from '../../../../src/domain/shared/enums';
import { Result } from '../../../../src/domain/shared/core/Result';

const USER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeSubscription(endpoint = 'https://push.example.com/a') {
  return PushSubscription.create({
    userId: USER_ID,
    endpoint,
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA',
    auth: 'tBHItJI5svbpez7KI4CCXg'
  }).value;
}

function makeRepo(
  subscriptions: PushSubscription[] = [makeSubscription()]
): jest.Mocked<IPushSubscriptionRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation(async (s: PushSubscription) =>
        Result.ok(s)
      ),
    listActive: jest.fn().mockResolvedValue(Result.ok(subscriptions)),
    listByUser: jest.fn().mockResolvedValue(Result.ok(subscriptions)),
    deleteByEndpoint: jest.fn().mockResolvedValue(Result.ok(true))
  };
}

function makeSender(): jest.Mocked<IPushSender> {
  return {
    send: jest.fn().mockResolvedValue(Result.ok('delivered'))
  };
}

function makeAlert(
  overrides: Partial<SendPushAlertDTO> = {}
): SendPushAlertDTO {
  return {
    deviceId: 'd0b5c0de-0000-4000-8000-000000000001',
    severity: AlertSeverity.CRITICAL,
    summary: 'Torre Norte está caída desde las 10:02',
    detail: null,
    resolved: false,
    type: 'device_unreachable',
    ...overrides
  };
}

describe('SubscribePushUseCase', () => {
  it('[NOT-220] saves the subscription for the signed-in user', async () => {
    const repo = makeRepo();
    const useCase = new SubscribePushUseCase(repo, makeLogger());

    const result = await useCase.execute({
      userId: USER_ID,
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'BNcRdre', auth: 'tBHItJI' },
      userAgent: 'Android'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.endpoint).toBe(
      'https://push.example.com/new'
    );
    expect(repo.save.mock.calls[0][0].userId).toBe(USER_ID);
  });

  it('refuses an invalid subscription without saving', async () => {
    const repo = makeRepo();
    const useCase = new SubscribePushUseCase(repo, makeLogger());

    const result = await useCase.execute({
      userId: USER_ID,
      endpoint: 'http://push.example.com/new',
      keys: { p256dh: 'BNcRdre', auth: 'tBHItJI' }
    });

    expect(result.error).toBe('endpoint must be an https URL');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('never logs the encryption keys', async () => {
    const logger = makeLogger();
    const useCase = new SubscribePushUseCase(makeRepo(), logger);

    await useCase.execute({
      userId: USER_ID,
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'BNcRdre', auth: 'secretAuth' }
    });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'secretAuth'
    );
  });
});

describe('UnsubscribePushUseCase', () => {
  it('[NOT-225] removes only the caller’s own subscription', async () => {
    const repo = makeRepo();
    const useCase = new UnsubscribePushUseCase(repo, makeLogger());

    const result = await useCase.execute({
      userId: USER_ID,
      endpoint: 'https://push.example.com/a'
    });

    expect(result.isSuccess).toBe(true);
    expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
      'https://push.example.com/a',
      USER_ID
    );
  });

  it('[NOT-225] succeeds when nothing was subscribed there', async () => {
    const repo = makeRepo();
    repo.deleteByEndpoint.mockResolvedValue(Result.ok(false));
    const useCase = new UnsubscribePushUseCase(repo, makeLogger());

    const result = await useCase.execute({
      userId: USER_ID,
      endpoint: 'https://push.example.com/a'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('requires an endpoint', async () => {
    const useCase = new UnsubscribePushUseCase(
      makeRepo(),
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      endpoint: ' '
    });

    expect(result.error).toBe('endpoint is required');
  });
});

describe('SendTestPushUseCase', () => {
  it('[NOT-226] sends to the caller’s phones and counts them', async () => {
    const repo = makeRepo([
      makeSubscription('https://push.example.com/a'),
      makeSubscription('https://push.example.com/b')
    ]);
    const sender = makeSender();
    const useCase = new SendTestPushUseCase(
      repo,
      sender,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.value).toEqual({ delivered: 2 });
    expect(repo.listByUser).toHaveBeenCalledWith(USER_ID);
    expect(repo.listActive).not.toHaveBeenCalled();
  });

  it('[NOT-226] fails when the caller has no phone subscribed', async () => {
    const useCase = new SendTestPushUseCase(
      makeRepo([]),
      makeSender(),
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.error).toBe(NO_PUSH_SUBSCRIPTION);
  });

  it('[NOT-226] fails when no phone received it', async () => {
    const sender = makeSender();
    sender.send.mockResolvedValue(
      Result.fail('Push service error 500')
    );
    const useCase = new SendTestPushUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.error).toBe(TEST_PUSH_NOT_DELIVERED);
  });
});

describe('SendPushAlertUseCase', () => {
  it('[NOT-222] sends the alert to every active subscription', async () => {
    const repo = makeRepo([
      makeSubscription('https://push.example.com/a'),
      makeSubscription('https://push.example.com/b')
    ]);
    const sender = makeSender();
    const useCase = new SendPushAlertUseCase(
      repo,
      sender,
      makeLogger()
    );

    const result = await useCase.execute(makeAlert());

    expect(result.value).toEqual({ delivered: 2 });
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(sender.send.mock.calls[0][1]).toEqual({
      title: '🔴 Torre Norte está caída desde las 10:02',
      body: '',
      url: '/devices/d0b5c0de-0000-4000-8000-000000000001',
      tag: 'device_unreachable:d0b5c0de-0000-4000-8000-000000000001',
      urgent: true
    });
  });

  it('[NOT-227] a recovery carries the outage’s tag and is not urgent', async () => {
    const sender = makeSender();
    const useCase = new SendPushAlertUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    await useCase.execute(makeAlert({ resolved: true }));

    const payload = sender.send.mock.calls[0][1];
    expect(payload.title.startsWith('✅')).toBe(true);
    expect(payload.tag).toBe(
      'device_unreachable:d0b5c0de-0000-4000-8000-000000000001'
    );
    expect(payload.urgent).toBe(false);
  });

  it('opens the alert list for an alert with no device', async () => {
    const sender = makeSender();
    const useCase = new SendPushAlertUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    await useCase.execute(
      makeAlert({
        deviceId: null,
        severity: AlertSeverity.WARNING,
        type: 'agent_offline',
        detail: 'Sin contacto desde 10:00'
      })
    );

    expect(sender.send.mock.calls[0][1]).toMatchObject({
      title: '🟡 Torre Norte está caída desde las 10:02',
      body: 'Sin contacto desde 10:00',
      url: '/alerts',
      tag: 'agent_offline:install'
    });
  });

  it('[NOT-222] one failing phone does not stop the others', async () => {
    const sender = makeSender();
    sender.send
      .mockResolvedValueOnce(Result.fail('Network error: timeout'))
      .mockResolvedValueOnce(Result.ok('delivered'));
    const useCase = new SendPushAlertUseCase(
      makeRepo([
        makeSubscription('https://push.example.com/a'),
        makeSubscription('https://push.example.com/b')
      ]),
      sender,
      makeLogger()
    );

    const result = await useCase.execute(makeAlert());

    expect(result.value).toEqual({ delivered: 1 });
  });

  it('[NOT-224] forgets a subscription the push service reports gone', async () => {
    const repo = makeRepo();
    const sender = makeSender();
    sender.send.mockResolvedValue(Result.ok('gone'));
    const useCase = new SendPushAlertUseCase(
      repo,
      sender,
      makeLogger()
    );

    const result = await useCase.execute(makeAlert());

    expect(result.value).toEqual({ delivered: 0 });
    expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
      'https://push.example.com/a'
    );
  });

  it('[NOT-224] keeps a subscription that merely failed', async () => {
    const repo = makeRepo();
    const sender = makeSender();
    sender.send.mockResolvedValue(
      Result.fail('Push service error 500')
    );
    const useCase = new SendPushAlertUseCase(
      repo,
      sender,
      makeLogger()
    );

    await useCase.execute(makeAlert());

    expect(repo.deleteByEndpoint).not.toHaveBeenCalled();
  });

  it('sends nothing with no subscriptions', async () => {
    const sender = makeSender();
    const useCase = new SendPushAlertUseCase(
      makeRepo([]),
      sender,
      makeLogger()
    );

    const result = await useCase.execute(makeAlert());

    expect(result.value).toEqual({ delivered: 0 });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('fails when the subscriptions cannot be loaded', async () => {
    const repo = makeRepo();
    repo.listActive.mockResolvedValue(Result.fail('db down'));
    const useCase = new SendPushAlertUseCase(
      repo,
      makeSender(),
      makeLogger()
    );

    const result = await useCase.execute(makeAlert());

    expect(result.isFailure).toBe(true);
  });
});
