// Source: src/application/wireless-monitoring/use-cases/DeleteWirelessConfigUseCase.ts

import { DeleteWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/DeleteWirelessConfigUseCase';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { PollingInterval } from '../../../../src/domain/shared/value-objects/PollingInterval';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn(),
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeConfig(): WirelessDeviceConfig {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(3600),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      lastPolledAt: null,
    }
  );
}

function makeConfigRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
  };
}

// ---------------------------------------------------------------------------

describe('DeleteWirelessConfigUseCase', () => {
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: DeleteWirelessConfigUseCase;

  beforeEach(() => {
    configRepo = makeConfigRepo();
    logger = makeLogger();
    useCase = new DeleteWirelessConfigUseCase(configRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call any repository when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
      expect(configRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should NOT call configRepo when deviceId is invalid', async () => {
      await useCase.execute({ deviceId: 'bad-id' });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — config lookup', () => {
    it('should fail when configRepo.findByDeviceId returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should fail when no config exists for the device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Wireless config not found for device');
    });

    it('should NOT call configRepo.delete when config is not found', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(configRepo.delete).not.toHaveBeenCalled();
    });

    it('should call configRepo.findByDeviceId with the parsed deviceId', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = configRepo.findByDeviceId.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('executeImpl — deletion', () => {
    it('should fail when configRepo.delete returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      configRepo.delete.mockResolvedValue(Result.fail('Constraint violation'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
    });

    it('should call configRepo.delete with the parsed deviceId', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      configRepo.delete.mockResolvedValue(Result.ok(undefined));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = configRepo.delete.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should call configRepo.delete exactly once when config exists', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      configRepo.delete.mockResolvedValue(Result.ok(undefined));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(configRepo.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path', () => {
    it('should return a successful Result when deletion succeeds', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      configRepo.delete.mockResolvedValue(Result.ok(undefined));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });
  });
});
