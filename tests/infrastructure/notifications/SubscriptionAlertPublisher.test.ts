import { SubscriptionAlertPublisher } from '../../../src/infrastructure/notifications/SubscriptionAlertPublisher';
import { GetSubscriptionStatusUseCase } from '../../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import {
  AlertNotification,
  IAlertPublisher,
  SUBSCRIPTION_EXPIRED_SUPPRESSED,
  isSuppressedPublish
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../src/domain/shared/core/Result';
import { makeLogger } from '../../application/probe-agents/fixtures';

const NOTIFICATION: AlertNotification = {
  deviceId: '550e8400-e29b-41d4-a716-446655440070',
  severity: AlertSeverity.CRITICAL,
  source: 'Disponibilidad',
  subject: 'Dispositivo fuera de línea',
  detail: 'No responde',
  occurredAt: new Date('2026-09-29T10:00:00.000Z'),
  resolved: false,
  type: 'device_unreachable'
};

function makeStatus(
  result: Awaited<ReturnType<GetSubscriptionStatusUseCase['execute']>>
) {
  return {
    execute: jest.fn().mockResolvedValue(result)
  } as unknown as GetSubscriptionStatusUseCase;
}

function status(readOnly: boolean) {
  return Result.ok({
    state: readOnly ? ('READ_ONLY' as const) : ('GRACE' as const),
    paidThrough: null,
    graceEndsAt: null,
    lockedAt: null,
    readOnly,
    locked: false
  });
}

describe('SubscriptionAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;

  beforeEach(() => {
    inner = { publish: jest.fn().mockResolvedValue(Result.ok()) };
  });

  it('[INS-023] forwards while the subscription is in grace or better', async () => {
    const result = await new SubscriptionAlertPublisher(
      inner,
      makeStatus(status(false)),
      makeLogger()
    ).publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(inner.publish).toHaveBeenCalledWith(NOTIFICATION);
  });

  it('[INS-023] withholds every alert once read-only, as a suppression', async () => {
    const result = await new SubscriptionAlertPublisher(
      inner,
      makeStatus(status(true)),
      makeLogger()
    ).publish({ ...NOTIFICATION, deviceId: null });

    expect(inner.publish).not.toHaveBeenCalled();
    expect(result.error).toBe(SUBSCRIPTION_EXPIRED_SUPPRESSED);
    expect(isSuppressedPublish(result.error)).toBe(true);
  });

  it('[INS-023] still sends when the status cannot be read', async () => {
    const logger = makeLogger();

    await new SubscriptionAlertPublisher(
      inner,
      makeStatus(Result.fail('boom')),
      logger
    ).publish(NOTIFICATION);

    expect(inner.publish).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
