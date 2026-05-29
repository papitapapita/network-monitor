// Source: src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts

import { PrismaPollingConfigurationRepository } from '../../../src/infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PollingConfigurationMapper } from '../../../src/infrastructure/mappers/PollingConfigurationMapper';
import { PollingConfiguration } from '../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../src/domain/device-monitoring/value-objects/FailureThreshold';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('../../../src/infrastructure/mappers/PollingConfigurationMapper');

const MockedMapper = PollingConfigurationMapper as jest.Mocked<
  typeof PollingConfigurationMapper
>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_IP = '10.0.0.1';
const FIXED_DATE = new Date('2024-06-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakePrismaClient() {
  return {
    pollingConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn()
    },
    $queryRaw: jest.fn()
  };
}

function makeFakePrismaRow(id = VALID_CONFIG_UUID) {
  return {
    id,
    deviceId: VALID_DEVICE_UUID,
    ipAddress: TEST_IP,
    enabled: true,
    pingIntervalSecs: 60,
    failuresBeforeDown: 3
  };
}

function makeFakeDomainEntity(): PollingConfiguration {
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress: IPAddress.reconstitute(TEST_IP),
      interval: PollingInterval.reconstitute({ seconds: 60 }),
      failuresBeforeDown: FailureThreshold.reconstitute({ count: 3 }),
      enabled: true
    }
  );
}

function makeFakePersistenceData() {
  return {
    id: VALID_CONFIG_UUID,
    deviceId: VALID_DEVICE_UUID,
    ipAddress: TEST_IP,
    enabled: true,
    pingIntervalSecs: 60,
    failuresBeforeDown: 3,
    lastPolledAt: null
  };
}

// ---------------------------------------------------------------------------

describe('PrismaPollingConfigurationRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repo: PrismaPollingConfigurationRepository;
  let fakeEntity: PollingConfiguration;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = new PrismaPollingConfigurationRepository(prisma as any);
    fakeEntity = makeFakeDomainEntity();

    MockedMapper.toDomain.mockReturnValue(fakeEntity);
    MockedMapper.toPersistence.mockReturnValue(makeFakePersistenceData());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('findById()', () => {
    it('should call prisma.pollingConfiguration.findUnique with the id string', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(makeFakePrismaRow());

      const id = PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
      await repo.findById(id);

      expect(prisma.pollingConfiguration.findUnique).toHaveBeenCalledWith({
        where: { id: VALID_CONFIG_UUID }
      });
    });

    it('should return a successful Result containing the mapped entity', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(makeFakePrismaRow());

      const id = PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
      const result = await repo.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeEntity);
    });

    it('should return a successful Result with null when the record is not found', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(null);

      const id = PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
      const result = await repo.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should not call toDomain when the record is not found', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(null);

      const id = PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
      await repo.findById(id);

      expect(MockedMapper.toDomain).not.toHaveBeenCalled();
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pollingConfiguration.findUnique.mockRejectedValue(
        new Error('Connection refused')
      );

      const id = PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
      const result = await repo.findById(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding polling config');
    });
  });

  // ===========================================================================
  describe('findByDeviceId()', () => {
    it('should call prisma.pollingConfiguration.findUnique with the deviceId string', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(makeFakePrismaRow());

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDeviceId(deviceId);

      expect(prisma.pollingConfiguration.findUnique).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID }
      });
    });

    it('should return a successful Result with the mapped entity', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(makeFakePrismaRow());

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeEntity);
    });

    it('should return a successful Result with null when no record exists', async () => {
      prisma.pollingConfiguration.findUnique.mockResolvedValue(null);

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pollingConfiguration.findUnique.mockRejectedValue(
        new Error('Timeout')
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding polling config');
    });
  });

  // ===========================================================================
  describe('findAllDue()', () => {
    const dueRow = {
      id: VALID_CONFIG_UUID,
      device_id: VALID_DEVICE_UUID,
      ip_address: TEST_IP,
      enabled: true,
      interval_seconds: 60,
      failures_before_down: 3
    };

    it('should call prisma.$queryRaw with the current date', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await repo.findAllDue(FIXED_DATE);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return a successful Result with an empty array when no configs are due', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await repo.findAllDue(FIXED_DATE);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should map each raw row via toDomain and return the mapped entities', async () => {
      prisma.$queryRaw.mockResolvedValue([dueRow]);

      const result = await repo.findAllDue(FIXED_DATE);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(MockedMapper.toDomain).toHaveBeenCalledTimes(1);
    });

    it('should pass the remapped row (camelCase) to toDomain', async () => {
      prisma.$queryRaw.mockResolvedValue([dueRow]);

      await repo.findAllDue(FIXED_DATE);

      expect(MockedMapper.toDomain).toHaveBeenCalledWith(
        expect.objectContaining({
          id: VALID_CONFIG_UUID,
          deviceId: VALID_DEVICE_UUID,
          ipAddress: TEST_IP,
          enabled: true,
          pingIntervalSecs: 60,
          failuresBeforeDown: 3
        })
      );
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Query error'));

      const result = await repo.findAllDue(FIXED_DATE);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding due polling configs');
    });
  });

  // ===========================================================================
  describe('save()', () => {
    it('should call toPersistence with the entity', async () => {
      prisma.pollingConfiguration.upsert.mockResolvedValue(makeFakePrismaRow());

      await repo.save(fakeEntity);

      expect(MockedMapper.toPersistence).toHaveBeenCalledWith(fakeEntity);
    });

    it('should call prisma.pollingConfiguration.upsert with create and update data', async () => {
      prisma.pollingConfiguration.upsert.mockResolvedValue(makeFakePrismaRow());

      await repo.save(fakeEntity);

      expect(prisma.pollingConfiguration.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.pollingConfiguration.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ deviceId: VALID_DEVICE_UUID });
      expect(call.create.id).toBe(VALID_CONFIG_UUID);
      expect(call.update).toBeDefined();
    });

    it('should return a successful Result containing the same entity', async () => {
      prisma.pollingConfiguration.upsert.mockResolvedValue(makeFakePrismaRow());

      const result = await repo.save(fakeEntity);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeEntity);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pollingConfiguration.upsert.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      const result = await repo.save(fakeEntity);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error saving polling config');
    });
  });

  // ===========================================================================
  describe('delete()', () => {
    it('should call prisma.pollingConfiguration.delete with the deviceId string', async () => {
      prisma.pollingConfiguration.delete.mockResolvedValue({});

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.delete(deviceId);

      expect(prisma.pollingConfiguration.delete).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID }
      });
    });

    it('should return a successful Result on successful deletion', async () => {
      prisma.pollingConfiguration.delete.mockResolvedValue({});

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.delete(deviceId);

      expect(result.isSuccess).toBe(true);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.pollingConfiguration.delete.mockRejectedValue(
        new Error('Record not found')
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.delete(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error deleting polling config');
    });
  });
});
