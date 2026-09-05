// Source: src/application/wireless-monitoring/event-handlers/DeviceStatusChangedWirelessConfigHandler.ts

import { DeviceStatusChangedWirelessConfigHandler } from '../../../../src/application/wireless-monitoring/event-handlers/DeviceStatusChangedWirelessConfigHandler';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository';
import { DeviceStatusChangedEvent } from '../../../../src/domain/device-inventory/events';
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
    findByParentApDeviceId: jest.fn(),
    findAll: jest.fn()
  };
}

function makeConfig(enabled: boolean) {
  return {
    enabled,
    enable: jest.fn().mockReturnValue(Result.ok()),
    disable: jest.fn().mockReturnValue(Result.ok())
  };
}

function makeEvent(
  previousStatus: DeviceStatus,
  newStatus: DeviceStatus
): DeviceStatusChangedEvent {
  return new DeviceStatusChangedEvent({
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.reconstitute('CPE-Casa-12'),
    previousStatus,
    newStatus,
    dateTimeOccurred: new Date('2026-08-13T10:00:00Z')
  });
}

const RETIRED_STATUSES: Array<[string, DeviceStatus]> = [
  ['INVENTORY', DeviceStatus.createInventory()],
  ['DAMAGED', DeviceStatus.createDamaged()],
  ['DECOMMISSIONED', DeviceStatus.createDecommissioned()]
];

// ---------------------------------------------------------------------------

describe('[DEV-089] DeviceStatusChangedWirelessConfigHandler', () => {
  let repo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceStatusChangedWirelessConfigHandler;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    handler = new DeviceStatusChangedWirelessConfigHandler(
      repo,
      logger
    );
    repo.save.mockResolvedValue(Result.ok({} as never));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retiring a device', () => {
    it.each(RETIRED_STATUSES)(
      'should disable an enabled wireless config when moved to %s',
      async (_label, status) => {
        const config = makeConfig(true);
        repo.findByDeviceId.mockResolvedValue(
          Result.ok(config as never)
        );

        await handler.handle(
          makeEvent(DeviceStatus.createActive(), status)
        );

        expect(config.disable).toHaveBeenCalledTimes(1);
        expect(config.enable).not.toHaveBeenCalled();
        expect(repo.save).toHaveBeenCalledTimes(1);
      }
    );

    it('should do nothing when the config is already disabled', async () => {
      const config = makeConfig(false);
      repo.findByDeviceId.mockResolvedValue(
        Result.ok(config as never)
      );

      await handler.handle(
        makeEvent(
          DeviceStatus.createActive(),
          DeviceStatus.createDamaged()
        )
      );

      expect(config.disable).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('returning a device to service', () => {
    // Mirrors DEV-059: arriving at COMMISSIONING is the one transition that
    // turns ICMP monitoring back on, so it is the one that turns wireless on.
    it('should re-enable when moved to COMMISSIONING', async () => {
      const config = makeConfig(false);
      repo.findByDeviceId.mockResolvedValue(
        Result.ok(config as never)
      );

      await handler.handle(
        makeEvent(
          DeviceStatus.createInventory(),
          DeviceStatus.createCommissioning()
        )
      );

      expect(config.enable).toHaveBeenCalledTimes(1);
      expect(config.disable).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    // ICMP does not re-enable here either — monitoringEnabled stays false and
    // an operator has to turn it back on deliberately.
    it('should leave polling off when moved straight from retired to ACTIVE', async () => {
      const config = makeConfig(false);
      repo.findByDeviceId.mockResolvedValue(
        Result.ok(config as never)
      );

      await handler.handle(
        makeEvent(
          DeviceStatus.createDamaged(),
          DeviceStatus.createActive()
        )
      );

      expect(config.enable).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should not touch an enabled config on an unrelated transition', async () => {
      const config = makeConfig(true);
      repo.findByDeviceId.mockResolvedValue(
        Result.ok(config as never)
      );

      await handler.handle(
        makeEvent(
          DeviceStatus.createCommissioning(),
          DeviceStatus.createActive()
        )
      );

      expect(config.enable).not.toHaveBeenCalled();
      expect(config.disable).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should do nothing when the config is already enabled at COMMISSIONING', async () => {
      const config = makeConfig(true);
      repo.findByDeviceId.mockResolvedValue(
        Result.ok(config as never)
      );

      await handler.handle(
        makeEvent(
          DeviceStatus.createInventory(),
          DeviceStatus.createCommissioning()
        )
      );

      expect(config.enable).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it('should do nothing when the device has no wireless config', async () => {
    repo.findByDeviceId.mockResolvedValue(Result.ok(null));

    await handler.handle(
      makeEvent(
        DeviceStatus.createActive(),
        DeviceStatus.createDamaged()
      )
    );

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should log and stop when the config cannot be loaded', async () => {
    repo.findByDeviceId.mockResolvedValue(
      Result.fail('DB connection lost')
    );

    await handler.handle(
      makeEvent(
        DeviceStatus.createActive(),
        DeviceStatus.createDamaged()
      )
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // Handlers run fire-and-forget; a throw here must not escape into the
  // dispatcher and take the request down with it.
  it('should swallow an unexpected throw', async () => {
    repo.findByDeviceId.mockRejectedValue(new Error('boom'));

    await expect(
      handler.handle(
        makeEvent(
          DeviceStatus.createActive(),
          DeviceStatus.createDamaged()
        )
      )
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
