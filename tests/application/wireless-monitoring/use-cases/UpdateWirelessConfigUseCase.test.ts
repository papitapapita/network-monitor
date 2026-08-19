// Source: src/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase.ts

import { UpdateWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase';
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
  overrides: {
    enabled?: boolean;
    ipAddress?: IPAddress | null;
    pollingInterval?: PollingInterval;
    deviceType?: 'STATION' | 'ACCESS_POINT';
    linkCapacityKbps?: number | null;
    clientsProvisionedLimit?: number | null;
  } = {}
): WirelessDeviceConfig {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId,
      ipAddress:
        overrides.ipAddress !== undefined
          ? overrides.ipAddress
          : null,
      enabled:
        overrides.enabled !== undefined ? overrides.enabled : true,
      pollingInterval:
        overrides.pollingInterval ??
        PollingInterval.reconstitute(3600),
      deviceType: overrides.deviceType ?? 'STATION',
      linkCapacityKbps:
        overrides.linkCapacityKbps !== undefined
          ? overrides.linkCapacityKbps
          : null,
      clientsProvisionedLimit:
        overrides.clientsProvisionedLimit !== undefined
          ? overrides.clientsProvisionedLimit
          : null,
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

// null = eligible; tests override to assert the enable guard.
function makeDeviceRepo(ineligibleReason: string | null = null) {
  return {
    findIdByMacAddress: jest.fn().mockResolvedValue(Result.ok(null)),
    findWirelessIneligibilityReason: jest
      .fn()
      .mockResolvedValue(Result.ok(ineligibleReason))
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-009] UpdateWirelessConfigUseCase', () => {
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let logger: jest.Mocked<ILogger>;
  let useCase: UpdateWirelessConfigUseCase;

  beforeEach(() => {
    configRepo = makeConfigRepo();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new UpdateWirelessConfigUseCase(
      configRepo,
      deviceRepo,
      logger
    );
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
        Result.fail('DB error')
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
  describe('executeImpl — ipAddress update branches', () => {
    beforeEach(() => {
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );
    });

    it('should NOT update ipAddress when ipAddress is undefined (skip)', async () => {
      const existingIp = IPAddress.create('192.168.1.1').value;
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: existingIp }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
        // ipAddress intentionally omitted
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe('192.168.1.1');
    });

    it('should clear ipAddress when ipAddress is null (clear)', async () => {
      const existingIp = IPAddress.create('192.168.1.1').value;
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: existingIp }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: null
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBeNull();
    });

    it('should set a new ipAddress when a valid string is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: '10.0.0.99'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe('10.0.0.99');
    });

    it('should fail when an invalid IP string is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: 'not-an-ip'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });
  });

  // ===========================================================================
  describe('executeImpl — enabled toggle branches', () => {
    beforeEach(() => {
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );
    });

    it('should enable the config when enabled is true', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: true
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.enabled).toBe(true);
    });

    it('should disable the config when enabled is false', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: true }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: false
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.enabled).toBe(false);
    });

    it('should NOT change enabled when enabled is undefined (skip)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: true }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
        // enabled intentionally omitted
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.enabled).toBe(true);
    });
  });

  // ===========================================================================
  // ===========================================================================
  describe('[DEV-089] executeImpl — enabling requires an eligible device', () => {
    function useCaseWithBlocker(reason: string | null) {
      deviceRepo = makeDeviceRepo(reason);
      return new UpdateWirelessConfigUseCase(
        configRepo,
        deviceRepo,
        logger
      );
    }

    it('should refuse to enable polling on a retired device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );
      const guarded = useCaseWithBlocker(
        'Device is DAMAGED and is not polled'
      );

      const result = await guarded.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: true
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot enable wireless polling'
      );
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    // Turning polling off must never be blocked — that direction is always safe.
    it('should allow disabling polling on a retired device', async () => {
      const config = makeConfig({ enabled: true });
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(config));
      configRepo.save.mockResolvedValue(Result.ok(config));
      const guarded = useCaseWithBlocker(
        'Device is DAMAGED and is not polled'
      );

      const result = await guarded.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: false
      });

      expect(result.isSuccess).toBe(true);
      expect(configRepo.save).toHaveBeenCalledTimes(1);
    });

    // Other fields stay editable — correcting an IP in the workshop is harmless.
    it('should not consult eligibility when enabled is not being set', async () => {
      const config = makeConfig();
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(config));
      configRepo.save.mockResolvedValue(Result.ok(config));
      const guarded = useCaseWithBlocker(
        'Device is DAMAGED and is not polled'
      );

      const result = await guarded.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSecs: 120
      });

      expect(result.isSuccess).toBe(true);
      expect(
        deviceRepo.findWirelessIneligibilityReason
      ).not.toHaveBeenCalled();
    });

    it('should fail when the eligibility check itself fails', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );
      deviceRepo = makeDeviceRepo();
      deviceRepo.findWirelessIneligibilityReason.mockResolvedValue(
        Result.fail('DB error')
      );
      const guarded = new UpdateWirelessConfigUseCase(
        configRepo,
        deviceRepo,
        logger
      );

      const result = await guarded.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: true
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('eligibility');
      expect(configRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — intervalSecs update', () => {
    beforeEach(() => {
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );
    });

    it('should update intervalSecs when a valid value is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSecs: 120
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.intervalSecs).toBe(120);
    });

    it('should NOT update intervalSecs when undefined (skip)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeConfig({
            pollingInterval: PollingInterval.reconstitute(3600)
          })
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
        // intervalSecs intentionally omitted
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.intervalSecs).toBe(3600);
    });

    it('should fail when intervalSecs is 0 (domain validation failure)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSecs: 0
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('polling interval');
    });

    it('should fail when intervalSecs is negative', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSecs: -1
      });

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — linkCapacityKbps update', () => {
    beforeEach(() => {
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );
    });

    it('should update linkCapacityKbps when a value is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        linkCapacityKbps: 50_000_000
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.linkCapacityKbps).toBe(50_000_000);
    });

    it('should clear linkCapacityKbps when null is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ linkCapacityKbps: 50_000_000 }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        linkCapacityKbps: null
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.linkCapacityKbps).toBeNull();
    });

    it('should NOT update linkCapacityKbps when undefined (skip)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ linkCapacityKbps: 50_000_000 }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
        // linkCapacityKbps intentionally omitted
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.linkCapacityKbps).toBe(50_000_000);
    });
  });

  // ===========================================================================
  describe('executeImpl — clientsProvisionedLimit update', () => {
    beforeEach(() => {
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );
    });

    it('should update clientsProvisionedLimit when a value is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ deviceType: 'ACCESS_POINT' }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        clientsProvisionedLimit: 20
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.clientsProvisionedLimit).toBe(20);
    });

    it('should clear clientsProvisionedLimit when null is provided', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeConfig({
            deviceType: 'ACCESS_POINT',
            clientsProvisionedLimit: 20
          })
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        clientsProvisionedLimit: null
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.clientsProvisionedLimit).toBeNull();
    });

    it('should NOT update clientsProvisionedLimit when undefined (skip)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeConfig({
            deviceType: 'ACCESS_POINT',
            clientsProvisionedLimit: 20
          })
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
        // clientsProvisionedLimit intentionally omitted
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.clientsProvisionedLimit).toBe(20);
    });
  });

  // ===========================================================================
  describe('executeImpl — persistence', () => {
    it('should fail when configRepo.save returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      configRepo.save.mockResolvedValue(Result.fail('Write failed'));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: false
      });

      expect(result.isFailure).toBe(true);
    });

    it('should call configRepo.save exactly once on the happy path', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );

      await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: false
      });

      expect(configRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path (no-op update)', () => {
    it('should return a successful Result when no fields are changed', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should include the deviceId in the response when no fields are changed', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      configRepo.save.mockImplementation((c) =>
        Promise.resolve(Result.ok(c))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });
  });
});
