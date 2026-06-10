import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GetMapLocationsUseCase } from '../../../../src/application/device-inventory/use-cases/GetMapLocationsUseCase';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository/ILocationRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Location } from '../../../../src/domain/device-inventory/aggregates/Location';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import { LocationType } from '../../../../src/domain/device-inventory/enums/LocationType';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import { Coordinates } from '../../../../src/domain/device-inventory/value-objects';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import {
  LocationId,
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { MACAddress } from '../../../../src/domain/shared';
import { IPAddress } from '../../../../src/domain/shared';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOC_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const LOC_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const DEV_ID_1 = '550e8400-e29b-41d4-a716-446655440010';
const DEV_ID_2 = '550e8400-e29b-41d4-a716-446655440011';
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440099';
const NOW = new Date('2024-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLocation(id: string, overrides: { type?: LocationType } = {}): Location {
  return Location.reconstitute(LocationId.parse(id).value, {
    name: `Location-${id.slice(-4)}`,
    type: overrides.type ?? LocationType.TOWER,
    municipality: 'Medellín',
    neighborhood: null,
    address: null,
    coordinates: Coordinates.reconstitute({
      latitude: 6.2442,
      longitude: -75.5812
    }),
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeDevice(id: string, locationId: string | null): Device {
  return Device.reconstitute(DeviceId.parse(id).value, {
    deviceModelId: DeviceModelId.parse(MODEL_ID).value,
    locationId: locationId ? LocationId.parse(locationId).value : null,
    status: DeviceStatus.reconstitute(DeviceStatus.ACTIVE),
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute(`Device-${id.slice(-4)}`),
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: IPAddress.create('192.168.1.1').value,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: true
  });
}

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
    setLevel: jest.fn()
  };
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
    findByLocationIds: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByFilters: jest.fn()
  } as any;
}

// ---------------------------------------------------------------------------

describe('GetMapLocationsUseCase', () => {
  let locationRepo: jest.Mocked<ILocationRepository>;
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let useCase: GetMapLocationsUseCase;

  beforeEach(() => {
    locationRepo = makeLocationRepo();
    deviceRepo = makeDeviceRepo();
    useCase = new GetMapLocationsUseCase(
      locationRepo,
      deviceRepo,
      makeLogger()
    );
  });

  // =========================================================================
  describe('happy path', () => {
    it('should return empty pins when no geolocated locations exist', async () => {
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([])
      );

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({ pins: [], total: 0 });
      expect(deviceRepo.findByLocationIds).not.toHaveBeenCalled();
    });

    it('should return pins with empty device lists when locations have no devices', async () => {
      const loc1 = makeLocation(LOC_ID_1);
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([loc1])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value!.pins).toHaveLength(1);
      expect(result.value!.pins[0].devices).toHaveLength(0);
      expect(result.value!.total).toBe(1);
    });

    it('should group devices under their correct location pin', async () => {
      const loc1 = makeLocation(LOC_ID_1);
      const loc2 = makeLocation(LOC_ID_2);
      const dev1 = makeDevice(DEV_ID_1, LOC_ID_1);
      const dev2 = makeDevice(DEV_ID_2, LOC_ID_2);

      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([loc1, loc2])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(
        Result.ok([dev1, dev2])
      );

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      const pins = result.value!.pins;
      expect(pins).toHaveLength(2);

      const pin1 = pins.find((p) => p.id === LOC_ID_1)!;
      const pin2 = pins.find((p) => p.id === LOC_ID_2)!;

      expect(pin1.devices).toHaveLength(1);
      expect(pin1.devices[0].id).toBe(DEV_ID_1);

      expect(pin2.devices).toHaveLength(1);
      expect(pin2.devices[0].id).toBe(DEV_ID_2);
    });

    it('should call findByLocationIds exactly once (no N+1)', async () => {
      const locations = [
        makeLocation(LOC_ID_1),
        makeLocation(LOC_ID_2)
      ];
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok(locations)
      );
      deviceRepo.findByLocationIds.mockResolvedValue(Result.ok([]));

      await useCase.execute({});

      expect(deviceRepo.findByLocationIds).toHaveBeenCalledTimes(1);
    });

    it('should populate pin coordinates and metadata from location', async () => {
      const loc = makeLocation(LOC_ID_1, { type: LocationType.POP });
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([loc])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({});

      const pin = result.value!.pins[0];
      expect(pin.latitude).toBe(6.2442);
      expect(pin.longitude).toBe(-75.5812);
      expect(pin.locationType).toBe(LocationType.POP);
      expect(pin.municipality).toBe('Medellín');
    });

    it('should include device fields in pin device DTOs', async () => {
      const loc = makeLocation(LOC_ID_1);
      const dev = makeDevice(DEV_ID_1, LOC_ID_1);

      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([loc])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(
        Result.ok([dev])
      );

      const result = await useCase.execute({});

      const dto = result.value!.pins[0].devices[0];
      expect(dto.id).toBe(DEV_ID_1);
      expect(dto.status).toBe(DeviceStatus.ACTIVE);
      expect(dto.monitoringEnabled).toBe(true);
      expect(dto.ipAddress).toBe('192.168.1.1');
    });

    it('should silently drop devices whose locationId is null', async () => {
      const loc = makeLocation(LOC_ID_1);
      const orphan = makeDevice(DEV_ID_1, null);

      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([loc])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(
        Result.ok([orphan])
      );

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value!.pins[0].devices).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('failure paths', () => {
    it('should fail when findAllWithCoordinates returns an error', async () => {
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.fail('DB error')
      );

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB error');
      expect(deviceRepo.findByLocationIds).not.toHaveBeenCalled();
    });

    it('should fail when findByLocationIds returns an error', async () => {
      locationRepo.findAllWithCoordinates.mockResolvedValue(
        Result.ok([makeLocation(LOC_ID_1)])
      );
      deviceRepo.findByLocationIds.mockResolvedValue(
        Result.fail('device query failed')
      );

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('device query failed');
    });
  });
});
