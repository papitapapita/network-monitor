// Source: src/infrastructure/notifications/MutedTypeAlertPublisher.ts

import { MutedTypeAlertPublisher } from '../../../src/infrastructure/notifications/MutedTypeAlertPublisher';
import {
  AlertNotification,
  IAlertPublisher,
  TYPE_MUTED_SUPPRESSED
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { IMutedAlertTypeRepository } from '../../../src/domain/notifications/repository/IMutedAlertTypeRepository';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440103';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeInner(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

function makeRepo(): jest.Mocked<IMutedAlertTypeRepository> {
  return {
    listAll: jest.fn(),
    isMuted: jest.fn().mockResolvedValue(Result.ok(false)),
    replaceAll: jest.fn()
  };
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeNotification(
  overrides: Partial<AlertNotification> = {}
): AlertNotification {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Enlace inalámbrico',
    subject: 'cpu_load_percent',
    detail: 'CPU crítico',
    occurredAt: FIXED_DATE,
    resolved: false,
    type: 'wireless:cpu_load_percent:CRITICAL',
    ...overrides
  };
}

describe('MutedTypeAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;
  let repo: jest.Mocked<IMutedAlertTypeRepository>;
  let logger: jest.Mocked<ILogger>;
  let publisher: MutedTypeAlertPublisher;

  beforeEach(() => {
    inner = makeInner();
    repo = makeRepo();
    logger = makeLogger();
    publisher = new MutedTypeAlertPublisher(inner, repo, logger);
  });

  afterEach(() => jest.clearAllMocks());

  describe('forwarding when not muted', () => {
    it('forwards to the inner publisher', async () => {
      const notification = makeNotification();
      await publisher.publish(notification);

      expect(inner.publish).toHaveBeenCalledWith(notification);
    });

    it('checks the bare metric, not the full wireless type string', async () => {
      await publisher.publish(
        makeNotification({ type: 'wireless:distance_m:WARNING' })
      );

      expect(repo.isMuted).toHaveBeenCalledWith('distance_m');
    });

    it('checks the type verbatim for a non-wireless alert', async () => {
      await publisher.publish(
        makeNotification({ type: 'device_unreachable' })
      );

      expect(repo.isMuted).toHaveBeenCalledWith(
        'device_unreachable'
      );
    });
  });

  describe('suppression when muted', () => {
    it('returns TYPE_MUTED_SUPPRESSED without forwarding', async () => {
      repo.isMuted.mockResolvedValue(Result.ok(true));

      const result = await publisher.publish(makeNotification());

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(TYPE_MUTED_SUPPRESSED);
      expect(inner.publish).not.toHaveBeenCalled();
    });

    it('mutes both severities of the same metric, severity-agnostic', async () => {
      repo.isMuted.mockResolvedValue(Result.ok(true));

      const warning = await publisher.publish(
        makeNotification({ type: 'wireless:cpu_load_percent:WARNING' })
      );
      const critical = await publisher.publish(
        makeNotification({
          type: 'wireless:cpu_load_percent:CRITICAL'
        })
      );

      expect(warning.isFailure).toBe(true);
      expect(critical.isFailure).toBe(true);
    });
  });

  describe('fail-open on repository error', () => {
    it('still forwards to the inner publisher when the mute check fails', async () => {
      repo.isMuted.mockResolvedValue(Result.fail('db down'));

      const result = await publisher.publish(makeNotification());

      expect(result.isSuccess).toBe(true);
      expect(inner.publish).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
