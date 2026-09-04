// Source: src/application/wireless-monitoring/use-cases/GetWirelessConfigUseCase.ts

import { GetWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessConfigUseCase';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';

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
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeConfig(
  overrides: { ipAddress?: string | null } = {}
): WirelessDeviceConfig {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const ipAddress =
    overrides.ipAddress != null
      ? IPAddress.create(overrides.ipAddress).value
      : null;
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId,
      ipAddress,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(3600),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      lastPolledAt: null
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
    findAll: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-011] GetWirelessConfigUseCase', () => {
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessConfigUseCase;

  beforeEach(() => {
    configRepo = makeConfigRepo();
    logger = makeLogger();
    useCase = new GetWirelessConfigUseCase(configRepo, logger);
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

    it('should NOT call configRepo when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({
        deviceId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should NOT call configRepo when deviceId is invalid', async () => {
      await useCase.execute({ deviceId: 'bad-id' });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — config loading', () => {
    it('should fail when configRepo.findByDeviceId returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB timeout')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
    });

    it('should fail when no config exists for the device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Wireless config not found for device'
      );
    });

    it('should call configRepo.findByDeviceId with the parsed deviceId', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = configRepo.findByDeviceId.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    it('should return a successful Result when config is found', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should include the id in the response', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.id).toBe(CONFIG_UUID);
    });

    it('should include the deviceId in the response', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include ipAddress as a string when set', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: '10.0.0.1' }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.ipAddress).toBe('10.0.0.1');
    });

    it('should include ipAddress as null when not set', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: null }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.ipAddress).toBeNull();
    });

    it('should include the correct deviceType in the response', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.deviceType).toBe('STATION');
    });

    it('should include enabled in the response', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.enabled).toBe(true);
    });

    it('should include lastPolledAt as null when never polled', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.lastPolledAt).toBeNull();
    });
  });
});
