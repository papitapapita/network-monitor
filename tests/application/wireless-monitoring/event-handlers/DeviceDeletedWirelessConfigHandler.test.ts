// Source: src/application/wireless-monitoring/event-handlers/DeviceDeletedWirelessConfigHandler.ts

import { DeviceDeletedWirelessConfigHandler } from '../../../../src/application/wireless-monitoring/event-handlers/DeviceDeletedWirelessConfigHandler';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository';
import { DeviceDeletedEvent } from '../../../../src/domain/device-inventory/events';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { DeviceId } from '../../../../src/domain/shared/ids';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
}

function makeRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    findAll: jest.fn()
  };
}

function makeConfig(enabled: boolean) {
  return {
    enabled,
    disable: jest.fn().mockReturnValue(Result.ok())
  };
}

function makeEvent(): DeviceDeletedEvent {
  const at = new Date('2026-08-11T10:00:00Z');
  return new DeviceDeletedEvent({
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.reconstitute('CPE-Casa-12'),
    status: DeviceStatus.createActive(),
    deletedBy: 'user-1',
    deletedAt: at,
    dateTimeOccurred: at
  });
}

// ---------------------------------------------------------------------------

describe('[DEV-072] DeviceDeletedWirelessConfigHandler', () => {
  let repo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceDeletedWirelessConfigHandler;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    handler = new DeviceDeletedWirelessConfigHandler(repo, logger);
    repo.save.mockResolvedValue(Result.ok({} as never));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should disable an enabled wireless config', async () => {
    const config = makeConfig(true);
    repo.findByDeviceId.mockResolvedValue(
      Result.ok(config as never)
    );

    await handler.handle(makeEvent());

    expect(config.disable).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when the device has no wireless config', async () => {
    repo.findByDeviceId.mockResolvedValue(Result.ok(null));

    await handler.handle(makeEvent());

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should do nothing when the config is already disabled', async () => {
    const config = makeConfig(false);
    repo.findByDeviceId.mockResolvedValue(
      Result.ok(config as never)
    );

    await handler.handle(makeEvent());

    expect(config.disable).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should log and stop when the config cannot be loaded', async () => {
    repo.findByDeviceId.mockResolvedValue(
      Result.fail('DB connection lost')
    );

    await handler.handle(makeEvent());

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // Handlers run fire-and-forget; a throw here must not escape into the
  // dispatcher and take the request down with it.
  it('should swallow an unexpected throw', async () => {
    repo.findByDeviceId.mockRejectedValue(new Error('boom'));

    await expect(
      handler.handle(makeEvent())
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
