// Source: src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts

import { CreateWirelessConfigUseCase } from '../../../../src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { DeviceModelId } from '../../../../src/domain/shared/ids/DeviceModelId';
import { DeviceName } from '../../../../src/domain/device-inventory/value-objects/DeviceName';
import { DeviceStatus } from '../../../../src/domain/device-inventory/value-objects/DeviceStatus';
import { DeviceCategory } from '../../../../src/domain/device-inventory/value-objects/DeviceCategory';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums/DeviceOwnerType';
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
    child: jest.fn(),
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeDevice(
  wirelessCapable = true,
  categoryOverride?: DeviceCategory
): Device {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const modelId = DeviceModelId.create();
  const category =
    categoryOverride ??
    (wirelessCapable
      ? DeviceCategory.createWirelessCpe()
      : DeviceCategory.createCpe());
  return Device.reconstitute(deviceId, {
    deviceModelId: modelId,
    locationId: null,
    status: DeviceStatus.reconstitute('INVENTORY'),
    category,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute('Test Device'),
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    monitoringEnabled: false,
  });
}

function makeConfig(): WirelessDeviceConfig {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const ipAddress = IPAddress.create('192.168.1.1').value;
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId,
      ipAddress,
      deviceType: 'STATION',
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(3600),
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      lastPolledAt: null,
    }
  );
}

function makeDeviceModelRepo(): jest.Mocked<IDeviceModelRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByVendor: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByVendorAndModel: jest.fn(),
    count: jest.fn(),
  } as any;
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn(),
  };
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

describe('CreateWirelessConfigUseCase', () => {
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let deviceModelRepo: jest.Mocked<IDeviceModelRepository>;
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: CreateWirelessConfigUseCase;

  beforeEach(() => {
    deviceRepo = makeDeviceRepo();
    deviceModelRepo = makeDeviceModelRepo();
    configRepo = makeConfigRepo();
    logger = makeLogger();
    useCase = new CreateWirelessConfigUseCase(
      deviceRepo,
      deviceModelRepo,
      configRepo,
      logger
    );
    (deviceModelRepo.findById as any).mockResolvedValue(
      Result.ok({ isWireless: true })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({
        deviceId: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({
        deviceId: '   ',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call any repository when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(deviceRepo.findById).not.toHaveBeenCalled();
      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({
        deviceId: 'not-a-uuid',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should NOT call deviceRepo.findById when deviceId is invalid', async () => {
      await useCase.execute({ deviceId: 'bad-id' });

      expect(deviceRepo.findById).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device lookup', () => {
    it('should fail when deviceRepo.findById returns a failure', async () => {
      deviceRepo.findById.mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB error');
    });

    it('should fail when the device does not exist', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('should call deviceRepo.findById with the parsed deviceId', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(null));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = deviceRepo.findById.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should fail when the device is not wireless-capable', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice(false)));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('WIRELESS_CPE');
    });

    it('should NOT call configRepo when device is not wireless-capable', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice(false)));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });

    it('[DEV-064] should reject linkCapacityKbps on an access point', async () => {
      deviceRepo.findById.mockResolvedValue(
        Result.ok(makeDevice(true, DeviceCategory.createAccessPoint()))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        linkCapacityKbps: 50000
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('linkCapacityKbps');
    });

    it('[DEV-064] should reject clientsProvisionedLimit on a station', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        clientsProvisionedLimit: 40
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('clientsProvisionedLimit');
    });

    it('should fail when the device model is not marked wireless', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      (deviceModelRepo.findById as any).mockResolvedValue(
        Result.ok({ isWireless: false })
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not wireless-capable');
    });

    it('should NOT call configRepo when the device model is not wireless', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      (deviceModelRepo.findById as any).mockResolvedValue(
        Result.ok({ isWireless: false })
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — duplicate config check', () => {
    it('should fail when a config already exists for the device', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
    });

    it('should fail when configRepo.findByDeviceId returns a failure', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — IP address validation', () => {
    it('should fail when ipAddress is provided but is not a valid IP', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: 'not-an-ip',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });

    it('should NOT fail when ipAddress is null', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      configRepo.save.mockImplementation((c) => Promise.resolve(Result.ok(c)));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: null,
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should NOT fail when ipAddress is omitted', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      configRepo.save.mockImplementation((c) => Promise.resolve(Result.ok(c)));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isSuccess).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — config persistence', () => {
    it('should fail when configRepo.save returns a failure', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      configRepo.save.mockResolvedValue(Result.fail('Write failed'));

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isFailure).toBe(true);
    });

    it('should call configRepo.save exactly once on the happy path', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      configRepo.save.mockImplementation((c) => Promise.resolve(Result.ok(c)));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(configRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    beforeEach(() => {
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      configRepo.save.mockImplementation((c) => Promise.resolve(Result.ok(c)));
    });

    it('should return a successful Result', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should include the deviceId in the response DTO', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should default enabled to true when not provided', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.value.enabled).toBe(true);
    });

    it('should default intervalSecs to 3600 when not provided', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.value.intervalSecs).toBe(3600);
    });

    it('[DEV-064] should derive deviceType STATION from a WIRELESS_CPE device', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.deviceType).toBe('STATION');
    });

    it('[DEV-064] should derive deviceType ACCESS_POINT from an ACCESS_POINT device', async () => {
      deviceRepo.findById.mockResolvedValue(
        Result.ok(
          makeDevice(true, DeviceCategory.createAccessPoint())
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.value.deviceType).toBe('ACCESS_POINT');
    });

    it('should include the provided ipAddress in the response', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        ipAddress: '10.0.0.5',
      });

      expect(result.value.ipAddress).toBe('10.0.0.5');
    });

    it('should set ipAddress to null in the response when not provided', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.value.ipAddress).toBeNull();
    });

    it('should set lastPolledAt to null for a newly created config', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
      });

      expect(result.value.lastPolledAt).toBeNull();
    });

    it('should use the provided enabled value when supplied', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        enabled: false,
      });

      expect(result.value.enabled).toBe(false);
    });

    it('should use the provided intervalSecs when supplied', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSecs: 60,
      });

      expect(result.value.intervalSecs).toBe(60);
    });
  });
});
