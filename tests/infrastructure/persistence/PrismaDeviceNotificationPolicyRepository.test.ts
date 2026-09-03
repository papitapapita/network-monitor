// Source: src/infrastructure/persistence/PrismaDeviceNotificationPolicyRepository.ts

import { PrismaDeviceNotificationPolicyRepository } from '../../../src/infrastructure/persistence/PrismaDeviceNotificationPolicyRepository';
import { DeviceNotificationPolicyMapper } from '../../../src/infrastructure/mappers/DeviceNotificationPolicyMapper';
import { DeviceNotificationPolicy } from '../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';

jest.mock(
  '../../../src/infrastructure/mappers/DeviceNotificationPolicyMapper'
);

const MockedMapper = DeviceNotificationPolicyMapper as jest.Mocked<
  typeof DeviceNotificationPolicyMapper
>;

const VALID_ID = '550e8400-e29b-41d4-a716-446655440098';
const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440099';

function makeFakePrismaClient() {
  return {
    deviceNotificationPolicy: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    }
  };
}

function makeFakePrismaRow() {
  return {
    id: VALID_ID,
    deviceId: VALID_DEVICE_UUID,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    alertDelayMinutes: 15
  };
}

function makeFakeDomainEntity(): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.parse(VALID_ID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      quietHours: null,
      alertDelayMinutes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  );
}

function makeFakePersistenceData() {
  return {
    id: VALID_ID,
    deviceId: VALID_DEVICE_UUID,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    alertDelayMinutes: 15,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe('PrismaDeviceNotificationPolicyRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repo: PrismaDeviceNotificationPolicyRepository;
  let fakeEntity: DeviceNotificationPolicy;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    repo = new PrismaDeviceNotificationPolicyRepository(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any
    );
    fakeEntity = makeFakeDomainEntity();

    MockedMapper.toDomain.mockReturnValue(fakeEntity);
    MockedMapper.toPersistence.mockReturnValue(
      makeFakePersistenceData()
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('findByDeviceId()', () => {
    it('should call prisma.deviceNotificationPolicy.findUnique with the deviceId string', async () => {
      prisma.deviceNotificationPolicy.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      await repo.findByDeviceId(deviceId);

      expect(
        prisma.deviceNotificationPolicy.findUnique
      ).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID }
      });
    });

    it('should return a successful Result with the mapped entity', async () => {
      prisma.deviceNotificationPolicy.findUnique.mockResolvedValue(
        makeFakePrismaRow()
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(fakeEntity);
    });

    it('[NOT-170] should return a successful Result with null when no policy row exists', async () => {
      prisma.deviceNotificationPolicy.findUnique.mockResolvedValue(
        null
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceNotificationPolicy.findUnique.mockRejectedValue(
        new Error('Connection refused')
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.findByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error finding notification policy'
      );
    });
  });

  describe('save()', () => {
    it('should upsert keyed on deviceId', async () => {
      prisma.deviceNotificationPolicy.upsert.mockResolvedValue(
        makeFakePrismaRow()
      );

      await repo.save(fakeEntity);

      expect(
        prisma.deviceNotificationPolicy.upsert
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: VALID_DEVICE_UUID }
        })
      );
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceNotificationPolicy.upsert.mockRejectedValue(
        new Error('Write conflict')
      );

      const result = await repo.save(fakeEntity);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Database error saving notification policy'
      );
    });
  });

  describe('[NOT-170] delete()', () => {
    it('should call deleteMany rather than delete, so a missing row is not an error', async () => {
      prisma.deviceNotificationPolicy.deleteMany.mockResolvedValue({
        count: 0
      });

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.delete(deviceId);

      expect(
        prisma.deviceNotificationPolicy.deleteMany
      ).toHaveBeenCalledWith({
        where: { deviceId: VALID_DEVICE_UUID }
      });
      expect(result.isSuccess).toBe(true);
    });

    it('should return a failed Result when Prisma throws', async () => {
      prisma.deviceNotificationPolicy.deleteMany.mockRejectedValue(
        new Error('Connection refused')
      );

      const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
      const result = await repo.delete(deviceId);

      expect(result.isFailure).toBe(true);
    });
  });
});
