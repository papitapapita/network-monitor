// Source: src/infrastructure/persistence/PrismaDeviceRepository.ts

import { PrismaDeviceRepository } from './PrismaDeviceRepository';
import { DeviceMapper } from '../mappers/DeviceMapper';
import { Device } from '../../domain/device-inventory/aggregates/Device';
import { DeviceId, LocationId, DeviceModelId } from '../../domain/shared/ids';
import {
  MACAddress,
  IPAddress,
  DeviceStatus,
  DeviceCategory
} from '../../domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../domain/device-inventory/enums';
import { Result, EventDispatcher } from '../../domain/shared/core';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock DeviceMapper so that toDomain / toPersistence can be controlled in
// isolation from the mapper's own logic.
jest.mock('../mappers/DeviceMapper');

// ---------------------------------------------------------------------------
// Typed alias for the mocked DeviceMapper
// ---------------------------------------------------------------------------

const MockedDeviceMapper = DeviceMapper as jest.Mocked<typeof DeviceMapper>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440003';

// ---------------------------------------------------------------------------
// Fake Prisma client factory
// ---------------------------------------------------------------------------

function makeFakePrismaClient(): {
  device: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
} {
  return {
    device: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

// ---------------------------------------------------------------------------
// Fake Prisma row factory
// ---------------------------------------------------------------------------

function makeFakePrismaRow(id = VALID_UUID_1): Record<string, unknown> {
  return {
    id,
    deviceModelId: VALID_UUID_2,
    locationId: VALID_UUID_3,
    status: 'ACTIVE',
    category: 'CORE',
    owner: 'COMPANY',
    name: 'Test Device',
    serialNumber: 'SN-001',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.1',
    description: 'A test device',
    installedDate: new Date('2023-11-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    monitoringEnabled: true
  };
}

// ---------------------------------------------------------------------------
// Fake persistence data factory (output of DeviceMapper.toPersistence)
// ---------------------------------------------------------------------------

function makeFakePersistenceData(id = VALID_UUID_1): Record<string, unknown> {
  return {
    id,
    deviceModelId: VALID_UUID_2,
    locationId: VALID_UUID_3,
    status: 'ACTIVE',
    category: 'CORE',
    owner: 'COMPANY',
    name: 'Test Device',
    serialNumber: 'SN-001',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.1',
    description: 'A test device',
    installedDate: new Date('2023-11-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    monitoringEnabled: true
  };
}

// ---------------------------------------------------------------------------
// Fake domain Device factory (uses Device.reconstitute for simplicity)
// ---------------------------------------------------------------------------

function makeFakeDevice(id = VALID_UUID_1): Device {
  const deviceId = DeviceId.parse(id).value;
  return Device.reconstitute(deviceId, {
    deviceModelId: DeviceModelId.parse(VALID_UUID_2).value as never,
    locationId: LocationId.parse(VALID_UUID_3).value,
    status: DeviceStatus.reconstitute('ACTIVE'),
    category: DeviceCategory.reconstitute('CORE'),
    ownerType: DeviceOwnerType.COMPANY,
    name: { toString: () => 'Test Device' } as never,
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    monitoringEnabled: true
  });
}

// ---------------------------------------------------------------------------

describe('PrismaDeviceRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repository: PrismaDeviceRepository;
  let fakeDevice: Device;
  let fakeDeviceId: DeviceId;
  let fakePersistenceData: Record<string, unknown>;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = makeFakePrismaClient();
    repository = new PrismaDeviceRepository(prisma as never);

    fakeDevice = makeFakeDevice();
    fakeDeviceId = DeviceId.parse(VALID_UUID_1).value;
    fakePersistenceData = makeFakePersistenceData();

    // Spy on EventDispatcher so we can verify dispatch calls without
    // triggering the real implementation in other tests.
    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);

    // Default happy-path stubs for the mocked mapper
    MockedDeviceMapper.toPersistence.mockReturnValue(fakePersistenceData);
    MockedDeviceMapper.toDomain.mockReturnValue(Result.ok(fakeDevice));
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  // =========================================================================
  describe('save()', () => {
    // -----------------------------------------------------------------------
    describe('success', () => {
      it('should call prisma.device.upsert with the correct where clause', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeDevice);

        expect(prisma.device.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: fakePersistenceData.id }
          })
        );
      });

      it('should call prisma.device.upsert with create set to the full persistence data', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeDevice);

        expect(prisma.device.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: fakePersistenceData
          })
        );
      });

      it('should include all mutable fields in the update clause', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeDevice);

        const call = prisma.device.upsert.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;

        expect(call.update).toEqual(
          expect.objectContaining({
            locationId: fakePersistenceData.locationId,
            status: fakePersistenceData.status,
            category: fakePersistenceData.category,
            owner: fakePersistenceData.owner,
            name: fakePersistenceData.name,
            serialNumber: fakePersistenceData.serialNumber,
            macAddress: fakePersistenceData.macAddress,
            ipAddress: fakePersistenceData.ipAddress,
            description: fakePersistenceData.description,
            installedDate: fakePersistenceData.installedDate,
            updatedAt: fakePersistenceData.updatedAt,
            monitoringEnabled: fakePersistenceData.monitoringEnabled
          })
        );
      });

      it('should return Result.ok containing the original device on success', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        const result = await repository.save(fakeDevice);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeDevice);
      });

      it('should dispatch domain events after a successful upsert', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeDevice);

        expect(dispatchSpy).toHaveBeenCalledWith(fakeDevice.id);
      });

      it('should call upsert exactly once', async () => {
        prisma.device.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeDevice);

        expect(prisma.device.upsert).toHaveBeenCalledTimes(1);
      });
    });

    // -----------------------------------------------------------------------
    describe('Prisma P2002 unique constraint error', () => {
      it('should return a failed Result without throwing', async () => {
        prisma.device.upsert.mockRejectedValue(
          new Error('Unique constraint failed P2002')
        );

        const result = await repository.save(fakeDevice);

        expect(result.isFailure).toBe(true);
      });

      it('should return the MAC / IP conflict message for P2002 errors', async () => {
        prisma.device.upsert.mockRejectedValue(
          new Error('Unique constraint failed P2002')
        );

        const result = await repository.save(fakeDevice);

        expect(result.error).toBe(
          'A device with this MAC address or IP address already exists'
        );
      });

      it('should not dispatch domain events on P2002 failure', async () => {
        prisma.device.upsert.mockRejectedValue(new Error('P2002 violation'));

        await repository.save(fakeDevice);

        expect(dispatchSpy).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('generic database error', () => {
      it('should return a failed Result for non-P2002 errors', async () => {
        prisma.device.upsert.mockRejectedValue(
          new Error('Connection timed out')
        );

        const result = await repository.save(fakeDevice);

        expect(result.isFailure).toBe(true);
      });

      it('should include the original message in the error', async () => {
        prisma.device.upsert.mockRejectedValue(
          new Error('Connection timed out')
        );

        const result = await repository.save(fakeDevice);

        expect(result.error).toContain('Connection timed out');
      });

      it('should prefix the error with "Database error saving device"', async () => {
        prisma.device.upsert.mockRejectedValue(new Error('disk full'));

        const result = await repository.save(fakeDevice);

        expect(result.error).toContain('Database error saving device');
      });

      it('should not dispatch domain events on a generic failure', async () => {
        prisma.device.upsert.mockRejectedValue(new Error('socket hang up'));

        await repository.save(fakeDevice);

        expect(dispatchSpy).not.toHaveBeenCalled();
      });

      it('should handle non-Error throwables gracefully', async () => {
        prisma.device.upsert.mockRejectedValue('unexpected string error');

        const result = await repository.save(fakeDevice);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('unexpected string error');
      });
    });
  });

  // =========================================================================
  describe('findById()', () => {
    // -----------------------------------------------------------------------
    describe('record not found', () => {
      it('should return Result.ok(null) when Prisma returns null', async () => {
        prisma.device.findUnique.mockResolvedValue(null);

        const result = await repository.findById(fakeDeviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });

      it('should not call DeviceMapper.toDomain when no record is found', async () => {
        prisma.device.findUnique.mockResolvedValue(null);

        await repository.findById(fakeDeviceId);

        expect(MockedDeviceMapper.toDomain).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('record found — mapping succeeds', () => {
      it('should call prisma.device.findUnique with the stringified id', async () => {
        prisma.device.findUnique.mockResolvedValue(makeFakePrismaRow());

        await repository.findById(fakeDeviceId);

        expect(prisma.device.findUnique).toHaveBeenCalledWith({
          where: { id: fakeDeviceId.toString() }
        });
      });

      it('should call DeviceMapper.toDomain with the raw row', async () => {
        const rawRow = makeFakePrismaRow();
        prisma.device.findUnique.mockResolvedValue(rawRow);

        await repository.findById(fakeDeviceId);

        expect(MockedDeviceMapper.toDomain).toHaveBeenCalledWith(rawRow);
      });

      it('should return Result.ok containing the mapped Device', async () => {
        prisma.device.findUnique.mockResolvedValue(makeFakePrismaRow());

        const result = await repository.findById(fakeDeviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeDevice);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.device.findUnique.mockRejectedValue(new Error('DB timeout'));

        const result = await repository.findById(fakeDeviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error with "Database error finding device"', async () => {
        prisma.device.findUnique.mockRejectedValue(new Error('network failure'));

        const result = await repository.findById(fakeDeviceId);

        expect(result.error).toContain('Database error finding device');
      });

      it('should include the original message in the error', async () => {
        prisma.device.findUnique.mockRejectedValue(new Error('network failure'));

        const result = await repository.findById(fakeDeviceId);

        expect(result.error).toContain('network failure');
      });
    });
  });

  // =========================================================================
  describe('delete()', () => {
    // -----------------------------------------------------------------------
    describe('success', () => {
      it('should call prisma.device.delete with the stringified id', async () => {
        prisma.device.delete.mockResolvedValue(makeFakePrismaRow());

        await repository.delete(fakeDeviceId);

        expect(prisma.device.delete).toHaveBeenCalledWith({
          where: { id: fakeDeviceId.toString() }
        });
      });

      it('should return Result.ok() on success', async () => {
        prisma.device.delete.mockResolvedValue(makeFakePrismaRow());

        const result = await repository.delete(fakeDeviceId);

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('P2025 — record not found', () => {
      it('should return a failed Result for P2025 errors', async () => {
        prisma.device.delete.mockRejectedValue(
          new Error('Record to delete does not exist P2025')
        );

        const result = await repository.delete(fakeDeviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should return the message "Device not found" for P2025 errors', async () => {
        prisma.device.delete.mockRejectedValue(
          new Error('P2025: Record not found')
        );

        const result = await repository.delete(fakeDeviceId);

        expect(result.error).toBe('Device not found');
      });
    });

    // -----------------------------------------------------------------------
    describe('generic database error', () => {
      it('should return a failed Result for any other Prisma error', async () => {
        prisma.device.delete.mockRejectedValue(
          new Error('foreign key constraint violation')
        );

        const result = await repository.delete(fakeDeviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error with "Database error deleting device"', async () => {
        prisma.device.delete.mockRejectedValue(new Error('disk full'));

        const result = await repository.delete(fakeDeviceId);

        expect(result.error).toContain('Database error deleting device');
      });

      it('should include the original message in the error', async () => {
        prisma.device.delete.mockRejectedValue(
          new Error('foreign key constraint violation')
        );

        const result = await repository.delete(fakeDeviceId);

        expect(result.error).toContain('foreign key constraint violation');
      });
    });
  });

  // =========================================================================
  describe('exists()', () => {
    // -----------------------------------------------------------------------
    describe('device exists', () => {
      it('should call prisma.device.count with the stringified id', async () => {
        prisma.device.count.mockResolvedValue(1);

        await repository.exists(fakeDeviceId);

        expect(prisma.device.count).toHaveBeenCalledWith({
          where: { id: fakeDeviceId.toString() }
        });
      });

      it('should return Result.ok(true) when count > 0', async () => {
        prisma.device.count.mockResolvedValue(1);

        const result = await repository.exists(fakeDeviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('device does not exist', () => {
      it('should return Result.ok(false) when count is 0', async () => {
        prisma.device.count.mockResolvedValue(0);

        const result = await repository.exists(fakeDeviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failed Result when prisma.device.count throws', async () => {
        prisma.device.count.mockRejectedValue(
          new Error('connection pool exhausted')
        );

        const result = await repository.exists(fakeDeviceId);

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error with "Database error checking device existence"', async () => {
        prisma.device.count.mockRejectedValue(new Error('socket hang up'));

        const result = await repository.exists(fakeDeviceId);

        expect(result.error).toContain(
          'Database error checking device existence'
        );
      });
    });
  });

  // =========================================================================
  describe('count()', () => {
    // -----------------------------------------------------------------------
    describe('success', () => {
      it('should return Result.ok(number) with the correct count', async () => {
        prisma.device.count.mockResolvedValue(42);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(42);
      });

      it('should return zero when there are no devices', async () => {
        prisma.device.count.mockResolvedValue(0);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failed Result when prisma.device.count throws', async () => {
        prisma.device.count.mockRejectedValue(
          new Error('replica unavailable')
        );

        const result = await repository.count();

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error with "Database error counting devices"', async () => {
        prisma.device.count.mockRejectedValue(new Error('timeout'));

        const result = await repository.count();

        expect(result.error).toContain('Database error counting devices');
      });
    });
  });

  // =========================================================================
  describe('findAll()', () => {
    // -----------------------------------------------------------------------
    describe('success — empty result set', () => {
      it('should return Result.ok([]) when no records exist', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toEqual([]);
      });
    });

    // -----------------------------------------------------------------------
    describe('success — multiple records', () => {
      it('should return Result.ok(devices) with all mapped devices', async () => {
        const device2 = makeFakeDevice(VALID_UUID_2);

        prisma.device.findMany.mockResolvedValue([
          makeFakePrismaRow(VALID_UUID_1),
          makeFakePrismaRow(VALID_UUID_2)
        ]);
        MockedDeviceMapper.toDomain
          .mockReturnValueOnce(Result.ok(fakeDevice))
          .mockReturnValueOnce(Result.ok(device2));

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toBe(fakeDevice);
        expect(result.value[1]).toBe(device2);
      });
    });

    // -----------------------------------------------------------------------
    describe('pagination parameters', () => {
      it('should pass limit as "take" to findMany', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findAll(10);

        expect(prisma.device.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10 })
        );
      });

      it('should pass offset as "skip" to findMany', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findAll(10, 20);

        expect(prisma.device.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 20 })
        );
      });

      it('should use orderBy createdAt desc by default', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findAll();

        expect(prisma.device.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: { createdAt: 'desc' } })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failed Result when findMany throws', async () => {
        prisma.device.findMany.mockRejectedValue(new Error('connection lost'));

        const result = await repository.findAll();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('connection lost');
      });

      it('should prefix the error with "Database error finding all devices"', async () => {
        prisma.device.findMany.mockRejectedValue(new Error('io error'));

        const result = await repository.findAll();

        expect(result.error).toContain('Database error finding all devices');
      });
    });
  });

  // =========================================================================
  describe('findByLocation()', () => {
    // -----------------------------------------------------------------------
    it('should pass locationId as a string filter to Prisma', async () => {
      const locationId = LocationId.parse(VALID_UUID_3).value;
      prisma.device.findMany.mockResolvedValue([]);

      await repository.findByLocation(locationId);

      expect(prisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { locationId: VALID_UUID_3 }
        })
      );
    });

    it('should return mapped devices', async () => {
      const locationId = LocationId.parse(VALID_UUID_3).value;
      prisma.device.findMany.mockResolvedValue([makeFakePrismaRow()]);

      const result = await repository.findByLocation(locationId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toBe(fakeDevice);
    });

    it('should return an empty array when no devices exist for the location', async () => {
      const locationId = LocationId.parse(VALID_UUID_3).value;
      prisma.device.findMany.mockResolvedValue([]);

      const result = await repository.findByLocation(locationId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('findByDeviceModel()', () => {
    // -----------------------------------------------------------------------
    it('should pass deviceModelId as a string filter to Prisma', async () => {
      const deviceModelId = DeviceModelId.parse(VALID_UUID_2).value;
      prisma.device.findMany.mockResolvedValue([]);

      await repository.findByDeviceModel(deviceModelId);

      expect(prisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceModelId: VALID_UUID_2 }
        })
      );
    });

    it('should return mapped devices', async () => {
      const deviceModelId = DeviceModelId.parse(VALID_UUID_2).value;
      prisma.device.findMany.mockResolvedValue([makeFakePrismaRow()]);

      const result = await repository.findByDeviceModel(deviceModelId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toBe(fakeDevice);
    });

    it('should return an empty array when no devices match the model', async () => {
      const deviceModelId = DeviceModelId.parse(VALID_UUID_2).value;
      prisma.device.findMany.mockResolvedValue([]);

      const result = await repository.findByDeviceModel(deviceModelId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('findByMacAddress()', () => {
    // -----------------------------------------------------------------------
    it('should return Result.ok(null) when Prisma returns null', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.findFirst.mockResolvedValue(null);

      const result = await repository.findByMacAddress(mac);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return the mapped device when found', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.findFirst.mockResolvedValue(makeFakePrismaRow());

      const result = await repository.findByMacAddress(mac);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeDevice);
    });

    it('should call prisma.device.findFirst with the MAC address filter', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.findFirst.mockResolvedValue(null);

      await repository.findByMacAddress(mac);

      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { macAddress: 'AA:BB:CC:DD:EE:FF' }
      });
    });

    it('should return a failed Result when Prisma throws', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await repository.findByMacAddress(mac);

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('findByIpAddress()', () => {
    // -----------------------------------------------------------------------
    it('should return Result.ok(null) when Prisma returns null', async () => {
      const ip = IPAddress.create('192.168.1.1').value;
      prisma.device.findFirst.mockResolvedValue(null);

      const result = await repository.findByIpAddress(ip);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return the mapped device when found', async () => {
      const ip = IPAddress.create('192.168.1.1').value;
      prisma.device.findFirst.mockResolvedValue(makeFakePrismaRow());

      const result = await repository.findByIpAddress(ip);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeDevice);
    });

    it('should call prisma.device.findFirst with the IP address filter', async () => {
      const ip = IPAddress.create('192.168.1.1').value;
      prisma.device.findFirst.mockResolvedValue(null);

      await repository.findByIpAddress(ip);

      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { ipAddress: '192.168.1.1' }
      });
    });

    it('should return a failed Result when Prisma throws', async () => {
      const ip = IPAddress.create('192.168.1.1').value;
      prisma.device.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await repository.findByIpAddress(ip);

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('findByStatus()', () => {
    // -----------------------------------------------------------------------
    it('should pass status as a string filter to Prisma', async () => {
      const status = DeviceStatus.createActive();
      prisma.device.findMany.mockResolvedValue([]);

      await repository.findByStatus(status);

      expect(prisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' }
        })
      );
    });

    it('should return mapped devices for the given status', async () => {
      const status = DeviceStatus.createActive();
      prisma.device.findMany.mockResolvedValue([makeFakePrismaRow()]);

      const result = await repository.findByStatus(status);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toBe(fakeDevice);
    });

    it('should return an empty array when no devices match the status', async () => {
      const status = DeviceStatus.createDecommissioned();
      prisma.device.findMany.mockResolvedValue([]);

      const result = await repository.findByStatus(status);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });
  });

  // =========================================================================
  describe('existsByMacAddress()', () => {
    // -----------------------------------------------------------------------
    it('should return Result.ok(true) when count > 0', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.count.mockResolvedValue(1);

      const result = await repository.existsByMacAddress(mac);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return Result.ok(false) when count is 0', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.count.mockResolvedValue(0);

      const result = await repository.existsByMacAddress(mac);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should call prisma.device.count with the MAC address filter', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.count.mockResolvedValue(1);

      await repository.existsByMacAddress(mac);

      expect(prisma.device.count).toHaveBeenCalledWith({
        where: { macAddress: 'AA:BB:CC:DD:EE:FF' }
      });
    });

    it('should return a failed Result when Prisma throws', async () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      prisma.device.count.mockRejectedValue(new Error('DB error'));

      const result = await repository.existsByMacAddress(mac);

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('existsByIpAddress()', () => {
    // -----------------------------------------------------------------------
    it('should return Result.ok(true) when count > 0', async () => {
      const ip = IPAddress.create('10.0.0.1').value;
      prisma.device.count.mockResolvedValue(1);

      const result = await repository.existsByIpAddress(ip);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return Result.ok(false) when count is 0', async () => {
      const ip = IPAddress.create('10.0.0.1').value;
      prisma.device.count.mockResolvedValue(0);

      const result = await repository.existsByIpAddress(ip);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should call prisma.device.count with the IP address filter', async () => {
      const ip = IPAddress.create('10.0.0.1').value;
      prisma.device.count.mockResolvedValue(0);

      await repository.existsByIpAddress(ip);

      expect(prisma.device.count).toHaveBeenCalledWith({
        where: { ipAddress: '10.0.0.1' }
      });
    });

    it('should return a failed Result when Prisma throws', async () => {
      const ip = IPAddress.create('10.0.0.1').value;
      prisma.device.count.mockRejectedValue(new Error('DB error'));

      const result = await repository.existsByIpAddress(ip);

      expect(result.isFailure).toBe(true);
    });
  });

  // =========================================================================
  describe('findByFilters()', () => {
    // -----------------------------------------------------------------------
    describe('where clause construction', () => {
      it('should build where with only status when only status filter is provided', async () => {
        const status = DeviceStatus.createActive();
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ status });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ status: 'ACTIVE' });
      });

      it('should build where with only owner when only owner filter is provided', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ owner: DeviceOwnerType.CLIENT });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ owner: 'CLIENT' });
      });

      it('should build where with only monitoringEnabled when provided', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ monitoringEnabled: true });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ monitoringEnabled: true });
      });

      it('should build where with locationId string when provided', async () => {
        const locationId = LocationId.parse(VALID_UUID_3).value;
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ locationId });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ locationId: VALID_UUID_3 });
      });

      it('should build where with deviceModelId string when provided', async () => {
        const deviceModelId = DeviceModelId.parse(VALID_UUID_2).value;
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ deviceModelId });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ deviceModelId: VALID_UUID_2 });
      });

      it('should build where with category string when provided', async () => {
        const category = DeviceCategory.createCore();
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ category });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({ category: 'CORE' });
      });

      it('should combine multiple filters in a single where object', async () => {
        const status = DeviceStatus.createActive();
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({
          status,
          owner: DeviceOwnerType.COMPANY,
          monitoringEnabled: false
        });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.where).toEqual({
          status: 'ACTIVE',
          owner: 'COMPANY',
          monitoringEnabled: false
        });
      });

      it('should not include keys for filters that are undefined', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ monitoringEnabled: true });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        const whereKeys = Object.keys(
          call.where as Record<string, unknown>
        );
        expect(whereKeys).not.toContain('status');
        expect(whereKeys).not.toContain('owner');
        expect(whereKeys).not.toContain('category');
      });
    });

    // -----------------------------------------------------------------------
    describe('search filter produces OR array', () => {
      it('should produce an OR array on name, macAddress, ipAddress, serialNumber', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ search: 'router' });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, Record<string, unknown>>;
        expect(call.where).toEqual({
          OR: [
            { name: { contains: 'router', mode: 'insensitive' } },
            { macAddress: { contains: 'router', mode: 'insensitive' } },
            { ipAddress: { contains: 'router', mode: 'insensitive' } },
            { serialNumber: { contains: 'router', mode: 'insensitive' } }
          ]
        });
      });

      it('should include other filters alongside the OR search', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({
          search: 'core',
          monitoringEnabled: true
        });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        const where = call.where as Record<string, unknown>;
        expect(where).toHaveProperty('OR');
        expect(where).toHaveProperty('monitoringEnabled', true);
      });
    });

    // -----------------------------------------------------------------------
    describe('sort options', () => {
      it('should use default orderBy { createdAt: "desc" } when no sortBy is given', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({});

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.orderBy).toEqual({ createdAt: 'desc' });
      });

      it('should use the specified sortBy field with default desc order', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ sortBy: 'name' });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.orderBy).toEqual({ name: 'desc' });
      });

      it('should use asc orderBy when sortOrder is ASC', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ sortBy: 'status', sortOrder: 'ASC' });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.orderBy).toEqual({ status: 'asc' });
      });

      it('should use desc orderBy when sortOrder is DESC', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({
          sortBy: 'updatedAt',
          sortOrder: 'DESC'
        });

        const call = prisma.device.findMany.mock
          .calls[0][0] as Record<string, unknown>;
        expect(call.orderBy).toEqual({ updatedAt: 'desc' });
      });
    });

    // -----------------------------------------------------------------------
    describe('pagination parameters', () => {
      it('should pass limit as "take" to findMany', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ limit: 5 });

        expect(prisma.device.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 5 })
        );
      });

      it('should pass offset as "skip" to findMany', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        await repository.findByFilters({ limit: 5, offset: 15 });

        expect(prisma.device.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 15 })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('result mapping', () => {
      it('should return Result.ok(devices) for matching records', async () => {
        prisma.device.findMany.mockResolvedValue([makeFakePrismaRow()]);

        const result = await repository.findByFilters({});

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toBe(fakeDevice);
      });

      it('should return Result.ok([]) when no records match the filters', async () => {
        prisma.device.findMany.mockResolvedValue([]);

        const result = await repository.findByFilters({});

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('database error', () => {
      it('should return a failed Result when findMany throws', async () => {
        prisma.device.findMany.mockRejectedValue(new Error('query timeout'));

        const result = await repository.findByFilters({});

        expect(result.isFailure).toBe(true);
      });

      it('should prefix the error with "Database error finding devices by filters"', async () => {
        prisma.device.findMany.mockRejectedValue(new Error('io error'));

        const result = await repository.findByFilters({});

        expect(result.error).toContain(
          'Database error finding devices by filters'
        );
      });

      it('should include the original message in the error', async () => {
        prisma.device.findMany.mockRejectedValue(new Error('query timeout'));

        const result = await repository.findByFilters({});

        expect(result.error).toContain('query timeout');
      });
    });
  });
});
