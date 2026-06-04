// Source: src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository.ts

import { PrismaWirelessDeviceConfigRepository } from '../../../../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';
import type { PrismaClient } from '../../../../src/generated/prisma/client';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const CONFIG_UUID  = '61b09316-4070-4461-9b1b-7ecbd2eda306';

const createMockPrisma = () => ({
  wirelessPollingConfiguration: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
});

const buildDomainConfig = (): WirelessDeviceConfig => {
  const deviceId = DeviceId.parse(DEVICE_UUID).value;
  const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;
  const ipAddress = IPAddress.create('192.168.1.100').value;

  return WirelessDeviceConfig.reconstitute(id, {
    deviceId,
    ipAddress,
    enabled: true,
    pollingInterval: PollingInterval.reconstitute(60),
    deviceType: 'STATION',
    linkCapacityBps: 100_000_000,
    clientsProvisionedLimit: 10,
    lastPolledAt: new Date('2024-01-01T12:00:00Z'),
  });
};

const makePrismaRow = () => ({
  id: CONFIG_UUID,
  deviceId: DEVICE_UUID,
  ipAddress: '192.168.1.100',
  enabled: true,
  intervalSecs: 60,
  deviceType: 'STATION',
  linkCapacityBps: 100_000_000n,
  clientsProvisionedLimit: 10,
  lastPolledAt: new Date('2024-01-01T12:00:00Z'),
});

// Shape returned by the raw $queryRaw (snake_case column names)
const makeRawRow = () => ({
  id: CONFIG_UUID,
  device_id: DEVICE_UUID,
  ip_address: '192.168.1.100',
  enabled: true,
  interval_secs: 60,
  device_type: 'STATION',
  link_capacity_bps: 100_000_000n,
  clients_provisioned_limit: 10,
  last_polled_at: new Date('2024-01-01T11:00:00Z'),
});

describe('PrismaWirelessDeviceConfigRepository', () => {
  let prismaMock: ReturnType<typeof createMockPrisma>;
  let repository: PrismaWirelessDeviceConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = createMockPrisma();
    repository = new PrismaWirelessDeviceConfigRepository(prismaMock as unknown as PrismaClient);
  });

  describe('save', () => {
    it('should call prisma.wirelessPollingConfiguration.upsert with the correct create and update payloads', async () => {
      prismaMock.wirelessPollingConfiguration.upsert.mockResolvedValue({});
      const config = buildDomainConfig();

      const result = await repository.save(config);

      expect(prismaMock.wirelessPollingConfiguration.upsert).toHaveBeenCalledTimes(1);
      const arg = prismaMock.wirelessPollingConfiguration.upsert.mock.calls[0][0] as {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      };
      expect(arg.where).toEqual({ deviceId: DEVICE_UUID });
      expect(arg.create).toMatchObject({ id: CONFIG_UUID, deviceId: DEVICE_UUID, intervalSecs: 60 });
      expect(arg.update).toMatchObject({ intervalSecs: 60, enabled: true });
      expect(result.isSuccess).toBe(true);
    });

    it('should return the original config instance on success', async () => {
      prismaMock.wirelessPollingConfiguration.upsert.mockResolvedValue({});
      const config = buildDomainConfig();

      const result = await repository.save(config);

      expect(result.value).toBe(config);
    });

    it('should return a failed Result when prisma.wirelessPollingConfiguration.upsert throws', async () => {
      prismaMock.wirelessPollingConfiguration.upsert.mockRejectedValue(new Error('constraint violation'));
      const config = buildDomainConfig();

      const result = await repository.save(config);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error saving wireless polling config');
      expect(result.error).toContain('constraint violation');
    });
  });

  describe('findById', () => {
    it('should return the domain entity when the record is found', async () => {
      prismaMock.wirelessPollingConfiguration.findUnique.mockResolvedValue(makePrismaRow());
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.id.toString()).toBe(CONFIG_UUID);
    });

    it('should call findUnique with the string id', async () => {
      prismaMock.wirelessPollingConfiguration.findUnique.mockResolvedValue(null);
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      await repository.findById(id);

      expect(prismaMock.wirelessPollingConfiguration.findUnique).toHaveBeenCalledWith({
        where: { id: CONFIG_UUID },
      });
    });

    it('should return Result.ok(null) when no record is found', async () => {
      prismaMock.wirelessPollingConfiguration.findUnique.mockResolvedValue(null);
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.findById(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessPollingConfiguration.findUnique.mockRejectedValue(new Error('timeout'));
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.findById(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless polling config by id');
    });
  });

  describe('exists', () => {
    it('should return true when count is greater than 0', async () => {
      prismaMock.wirelessPollingConfiguration.count.mockResolvedValue(1);
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.exists(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false when count is 0', async () => {
      prismaMock.wirelessPollingConfiguration.count.mockResolvedValue(0);
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.exists(id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessPollingConfiguration.count.mockRejectedValue(new Error('DB down'));
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const result = await repository.exists(id);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error checking wireless polling config existence');
    });
  });

  describe('findByDeviceId', () => {
    it('should call findFirst with the deviceId filter', async () => {
      prismaMock.wirelessPollingConfiguration.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findByDeviceId(deviceId);

      expect(prismaMock.wirelessPollingConfiguration.findFirst).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID },
      });
    });

    it('should return the domain entity when found', async () => {
      prismaMock.wirelessPollingConfiguration.findFirst.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.deviceId.toString()).toBe(DEVICE_UUID);
    });

    it('should return Result.ok(null) when no config exists for the device', async () => {
      prismaMock.wirelessPollingConfiguration.findFirst.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return a failed Result when prisma throws', async () => {
      prismaMock.wirelessPollingConfiguration.findFirst.mockRejectedValue(new Error('DB error'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding wireless polling config');
    });
  });

  describe('findAllDue', () => {
    it('should call $queryRaw with the provided now date and return mapped domain entities', async () => {
      prismaMock.$queryRaw.mockResolvedValue([makeRawRow()]);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = await repository.findAllDue(now);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.deviceId.toString()).toBe(DEVICE_UUID);
    });

    it('should return an empty array when no configs are due', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      const now = new Date();

      const result = await repository.findAllDue(now);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should correctly map snake_case raw columns to camelCase domain fields', async () => {
      prismaMock.$queryRaw.mockResolvedValue([makeRawRow()]);

      const result = await repository.findAllDue(new Date());

      expect(result.isSuccess).toBe(true);
      const config = result.value[0]!;
      expect(config.pollingInterval.seconds).toBe(60);
      expect(config.ipAddress?.value).toBe('192.168.1.100');
    });

    it('should return a failed Result when $queryRaw throws', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('query syntax error'));

      const result = await repository.findAllDue(new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding due wireless polling configs');
    });
  });

  describe('delete', () => {
    it('should call prisma.wirelessPollingConfiguration.deleteMany with the deviceId filter', async () => {
      prismaMock.wirelessPollingConfiguration.deleteMany.mockResolvedValue({ count: 1 });
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.delete(deviceId);

      expect(prismaMock.wirelessPollingConfiguration.deleteMany).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID },
      });
      expect(result.isSuccess).toBe(true);
    });

    it('should return Result.ok(undefined) after a successful delete', async () => {
      prismaMock.wirelessPollingConfiguration.deleteMany.mockResolvedValue({ count: 1 });
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.delete(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return a failed Result when prisma.deleteMany throws', async () => {
      prismaMock.wirelessPollingConfiguration.deleteMany.mockRejectedValue(new Error('FK violation'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.delete(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error deleting wireless polling config');
    });
  });
});
