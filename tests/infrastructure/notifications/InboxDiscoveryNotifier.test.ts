// Source: src/infrastructure/notifications/InboxDiscoveryNotifier.ts

import {
  InboxDiscoveryNotifier,
  DEVICE_DISCOVERED_TYPE
} from '../../../src/infrastructure/notifications/InboxDiscoveryNotifier';
import { RecordInboxNotificationUseCase } from '../../../src/application/notifications/use-cases';
import { ILogger } from '../../../src/application/shared/interfaces';
import { AlertSeverity } from '../../../src/domain/shared/enums';
import { Result } from '../../../src/domain/shared/core';

const AT = new Date('2026-11-01T10:00:00Z');

describe('InboxDiscoveryNotifier', () => {
  let recordUseCase: jest.Mocked<RecordInboxNotificationUseCase>;
  let logger: jest.Mocked<ILogger>;
  let notifier: InboxDiscoveryNotifier;

  beforeEach(() => {
    recordUseCase = {
      execute: jest.fn().mockResolvedValue(Result.ok({ recorded: 1 }))
    } as unknown as jest.Mocked<RecordInboxNotificationUseCase>;
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    };
    notifier = new InboxDiscoveryNotifier(recordUseCase, logger);
  });

  it('[DEV-206] records an install-wide notice of the device type', async () => {
    await notifier.newDevicesFound({
      count: 3,
      where: '192.168.1.0/24',
      occurredAt: AT
    });

    expect(recordUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DEVICE_DISCOVERED_TYPE,
        severity: AlertSeverity.WARNING,
        resolved: false,
        title:
          'Se detectaron 3 dispositivos nuevos en 192.168.1.0/24',
        deviceId: null,
        alertId: null,
        occurredAt: AT
      })
    );
  });

  it('words a single device in the singular', async () => {
    await notifier.newDevicesFound({
      count: 1,
      where: '10.0.0.0/24',
      occurredAt: AT
    });

    expect(recordUseCase.execute.mock.calls[0][0].title).toBe(
      'Se detectó un dispositivo nuevo en 10.0.0.0/24'
    );
  });

  it('logs and swallows a failed recording', async () => {
    recordUseCase.execute.mockResolvedValue(Result.fail('db down'));

    await expect(
      notifier.newDevicesFound({
        count: 1,
        where: 'x',
        occurredAt: AT
      })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
