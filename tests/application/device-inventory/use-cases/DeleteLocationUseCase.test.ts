// Source: src/application/device-inventory/use-cases/DeleteLocationUseCase.ts

import { DeleteLocationUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteLocationUseCase';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository/ILocationRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Location } from '../../../../src/domain/device-inventory/aggregates/Location';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import { LocationId, DeviceId, DeviceModelId } from '../../../../src/domain/shared/ids';
import { LocationType } from '../../../../src/domain/device-inventory/enums/LocationType';
import { DeviceName, DeviceStatus } from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums/DeviceOwnerType';
import { MACAddress } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_LOCATION_ID = '550e8400-e29b-41d4-a716-446655440010';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-06-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLocation(): Location {
  const id = LocationId.parse(VALID_LOCATION_ID).value;
  return Location.reconstitute(id, {
    name: 'Tower Alpha',
    type: LocationType.TOWER,
    address: null,
    coordinates: null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeDevice(): Device {
  return Device.reconstitute(DeviceId.create(), {
    deviceModelId: DeviceModelId.parse(VALID_DEVICE_MODEL).value,
    locationId: LocationId.parse(VALID_LOCATION_ID).value,
    name: DeviceName.create('CPE-001').value,
    status: DeviceStatus.create('ACTIVE').value,
    ownerType: DeviceOwnerType.COMPANY,
    category: null,
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: null,
    description: null,
    installedDate: null,
    monitoringEnabled: false,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeLocationRepo(): jest.Mocked<ILocationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByType: jest.fn(),
    findAllWithCoordinates: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByLocationIds: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByFilters: jest.fn(),
    delete: jest.fn()
  } as unknown as jest.Mocked<IDeviceRepository>;
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
    setLevel: jest.fn()
  };
}

// ---------------------------------------------------------------------------
describe('DeleteLocationUseCase', () => {
  let locationRepo: jest.Mocked<ILocationRepository>;
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let useCase: DeleteLocationUseCase;

  beforeEach(() => {
    locationRepo = makeLocationRepo();
    deviceRepo = makeDeviceRepo();
    useCase = new DeleteLocationUseCase(
      locationRepo,
      deviceRepo,
      makeLogger()
    );
  });

  // =========================================================================
  describe('happy path', () => {
    it('should return a successful Result when the location exists and has no devices', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(Result.ok([]));
      locationRepo.delete.mockResolvedValue(Result.ok());

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isSuccess).toBe(true);
    });

    it('should call locationRepository.delete with the correct LocationId', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(Result.ok([]));
      locationRepo.delete.mockResolvedValue(Result.ok());

      await useCase.execute({ id: VALID_LOCATION_ID });

      expect(locationRepo.delete).toHaveBeenCalledTimes(1);
      const calledWith = locationRepo.delete.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_LOCATION_ID);
    });
  });

  // =========================================================================
  describe('validation failures', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute({ id: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('required');
    });

    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute({ id: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid location ID');
    });
  });

  // =========================================================================
  describe('not found', () => {
    it('should fail when the location does not exist', async () => {
      locationRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
    });

    it('should not attempt deletion when the location is not found', async () => {
      locationRepo.findById.mockResolvedValue(Result.ok(null));

      await useCase.execute({ id: VALID_LOCATION_ID });

      expect(locationRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('conflict — location has devices', () => {
    it('should fail when the location has one or more assigned devices', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(
        Result.ok([makeDevice()])
      );

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot delete');
      expect(result.error).toContain('1 device');
    });

    it('should not call locationRepository.delete when devices are assigned', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(
        Result.ok([makeDevice(), makeDevice()])
      );

      await useCase.execute({ id: VALID_LOCATION_ID });

      expect(locationRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('infrastructure failures', () => {
    it('should fail when locationRepository.findById rejects', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });

    it('should fail when deviceRepository.findByLocation rejects', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(
        Result.fail('DB timeout')
      );

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB timeout');
    });

    it('should fail when locationRepository.delete rejects', async () => {
      locationRepo.findById.mockResolvedValue(
        Result.ok(makeLocation())
      );
      deviceRepo.findByLocation.mockResolvedValue(Result.ok([]));
      locationRepo.delete.mockResolvedValue(
        Result.fail('Constraint violation')
      );

      const result = await useCase.execute({ id: VALID_LOCATION_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Constraint violation');
    });
  });
});
