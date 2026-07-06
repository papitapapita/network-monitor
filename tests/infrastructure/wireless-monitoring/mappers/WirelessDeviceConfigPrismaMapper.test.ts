// Source: src/infrastructure/wireless-monitoring/mappers/WirelessDeviceConfigPrismaMapper.ts

import { WirelessDeviceConfigPrismaMapper } from '../../../../src/infrastructure/wireless-monitoring/mappers/WirelessDeviceConfigPrismaMapper';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const CONFIG_UUID  = '61b09316-4070-4461-9b1b-7ecbd2eda306';

type PrismaWirelessDeviceConfigRow = Parameters<typeof WirelessDeviceConfigPrismaMapper.toDomain>[0];

const makeFullRow = (): PrismaWirelessDeviceConfigRow => ({
  id: CONFIG_UUID,
  deviceId: DEVICE_UUID,
  ipAddress: '192.168.1.100',
  enabled: true,
  intervalSecs: 60,
  deviceType: 'STATION',
  linkCapacityKbps: 100_000_000n,
  clientsProvisionedLimit: 10,
  lastPolledAt: new Date('2024-01-01T12:00:00Z'),
});

const makeMinimalRow = (): PrismaWirelessDeviceConfigRow => ({
  id: CONFIG_UUID,
  deviceId: DEVICE_UUID,
  ipAddress: null,
  enabled: false,
  intervalSecs: 30,
  deviceType: 'ACCESS_POINT',
  linkCapacityKbps: null,
  clientsProvisionedLimit: null,
  lastPolledAt: null,
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
    linkCapacityKbps: 100_000_000,
    clientsProvisionedLimit: 10,
    lastPolledAt: new Date('2024-01-01T12:00:00Z'),
  });
};

describe('WirelessDeviceConfigPrismaMapper', () => {
  describe('toDomain', () => {
    it('should map all fields from a full Prisma row to the domain entity', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeFullRow());

      expect(config.id.toString()).toBe(CONFIG_UUID);
      expect(config.deviceId.toString()).toBe(DEVICE_UUID);
      expect(config.ipAddress?.value).toBe('192.168.1.100');
      expect(config.enabled).toBe(true);
      expect(config.pollingInterval.seconds).toBe(60);
      expect(config.deviceType).toBe('STATION');
      expect(config.linkCapacityKbps).toBe(100_000_000);
      expect(config.clientsProvisionedLimit).toBe(10);
      expect(config.lastPolledAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });

    it('should convert BigInt linkCapacityKbps to a number', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeFullRow());

      expect(typeof config.linkCapacityKbps).toBe('number');
      expect(config.linkCapacityKbps).toBe(100_000_000);
    });

    it('should set ipAddress to null when the Prisma row has a null ipAddress', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeMinimalRow());

      expect(config.ipAddress).toBeNull();
    });

    it('should reconstitute ipAddress from persistence without validating', () => {
      const row = { ...makeMinimalRow(), ipAddress: '192.168.1.1' };

      const config = WirelessDeviceConfigPrismaMapper.toDomain(row);

      expect(config.ipAddress).not.toBeNull();
      expect(config.ipAddress?.value).toBe('192.168.1.1');
    });

    it('should set linkCapacityKbps to null when the Prisma row has a null value', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeMinimalRow());

      expect(config.linkCapacityKbps).toBeNull();
    });

    it('should set lastPolledAt to null when the Prisma row has a null value', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeMinimalRow());

      expect(config.lastPolledAt).toBeNull();
    });

    it('should map ACCESS_POINT deviceType correctly', () => {
      const config = WirelessDeviceConfigPrismaMapper.toDomain(makeMinimalRow());

      expect(config.deviceType).toBe('ACCESS_POINT');
    });

    it('should throw when the deviceId is not a valid UUID', () => {
      const row = { ...makeMinimalRow(), deviceId: 'bad-uuid' };

      expect(() => WirelessDeviceConfigPrismaMapper.toDomain(row)).toThrow('Invalid device ID');
    });

    it('should throw when the config id is not a valid UUID', () => {
      const row = { ...makeMinimalRow(), id: 'not-valid' };

      expect(() => WirelessDeviceConfigPrismaMapper.toDomain(row)).toThrow('Invalid config ID');
    });
  });

  describe('toPersistence', () => {
    it('should map all domain entity fields to the persistence shape', () => {
      const config = buildDomainConfig();

      const data = WirelessDeviceConfigPrismaMapper.toPersistence(config);

      expect(data.id).toBe(CONFIG_UUID);
      expect(data.deviceId).toBe(DEVICE_UUID);
      expect(data.ipAddress).toBe('192.168.1.100');
      expect(data.enabled).toBe(true);
      expect(data.intervalSecs).toBe(60);
      expect(data.deviceType).toBe('STATION');
      expect(data.linkCapacityKbps).toBe(100_000_000n);
      expect(data.clientsProvisionedLimit).toBe(10);
      expect(data.lastPolledAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });

    it('should convert number linkCapacityKbps to BigInt for persistence', () => {
      const config = buildDomainConfig();

      const data = WirelessDeviceConfigPrismaMapper.toPersistence(config);

      expect(typeof data.linkCapacityKbps).toBe('bigint');
    });

    it('should set ipAddress to null when the domain entity has no IP address', () => {
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const id = WirelessDeviceConfigId.parse(CONFIG_UUID).value;

      const config = WirelessDeviceConfig.reconstitute(id, {
        deviceId,
        ipAddress: null,
        enabled: false,
        pollingInterval: PollingInterval.reconstitute(30),
        deviceType: 'ACCESS_POINT',
        linkCapacityKbps: null,
        clientsProvisionedLimit: null,
        lastPolledAt: null,
      });

      const data = WirelessDeviceConfigPrismaMapper.toPersistence(config);

      expect(data.ipAddress).toBeNull();
      expect(data.linkCapacityKbps).toBeNull();
      expect(data.lastPolledAt).toBeNull();
    });
  });

  describe('round-trip: toDomain → toPersistence', () => {
    it('should produce persistence data with matching scalar fields after a round-trip from a full row', () => {
      const row = makeFullRow();
      const config = WirelessDeviceConfigPrismaMapper.toDomain(row);
      const back = WirelessDeviceConfigPrismaMapper.toPersistence(config);

      expect(back.id).toBe(row.id);
      expect(back.deviceId).toBe(row.deviceId);
      expect(back.ipAddress).toBe(row.ipAddress);
      expect(back.enabled).toBe(row.enabled);
      expect(back.intervalSecs).toBe(row.intervalSecs);
      expect(back.deviceType).toBe(row.deviceType);
      expect(back.linkCapacityKbps).toBe(row.linkCapacityKbps);
      expect(back.clientsProvisionedLimit).toBe(row.clientsProvisionedLimit);
    });

    it('should preserve null fields through a round-trip from a minimal row', () => {
      const row = makeMinimalRow();
      const config = WirelessDeviceConfigPrismaMapper.toDomain(row);
      const back = WirelessDeviceConfigPrismaMapper.toPersistence(config);

      expect(back.ipAddress).toBeNull();
      expect(back.linkCapacityKbps).toBeNull();
      expect(back.lastPolledAt).toBeNull();
      expect(back.clientsProvisionedLimit).toBeNull();
    });
  });
});
