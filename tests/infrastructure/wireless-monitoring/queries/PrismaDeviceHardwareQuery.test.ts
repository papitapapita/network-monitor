// Source: src/infrastructure/wireless-monitoring/queries/PrismaDeviceHardwareQuery.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceHardwareQuery } from '../../../../src/infrastructure/wireless-monitoring/queries/PrismaDeviceHardwareQuery';
import { DeviceId } from '../../../../src/domain/shared/ids';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440001';
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440010';
const VENDOR_ID = '550e8400-e29b-41d4-a716-446655440020';

function makeFakePrismaClient() {
  return {
    device: { findFirst: jest.fn(), findMany: jest.fn() },
    deviceModel: { findMany: jest.fn() },
    $queryRaw: jest.fn()
  };
}

function makeRow(status = 'ACTIVE') {
  return {
    id: DEVICE_ID,
    name: 'AP Torre Norte',
    macAddress: 'AA:BB:CC:DD:EE:01',
    status,
    deviceModel: {
      id: MODEL_ID,
      model: 'Rocket 5AC Lite',
      vendorId: VENDOR_ID
    }
  };
}

describe('[WLS-152] PrismaDeviceHardwareQuery', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let query: PrismaDeviceHardwareQuery;

  beforeEach(() => {
    prisma = makeFakePrismaClient();
    query = new PrismaDeviceHardwareQuery(
      prisma as unknown as PrismaClient
    );
  });

  describe('findHardware', () => {
    it('should map a live device and its model', async () => {
      prisma.device.findFirst.mockResolvedValue(makeRow());

      const result = await query.findHardware(
        DeviceId.parse(DEVICE_ID).value
      );

      expect(result.value).toEqual({
        deviceId: DEVICE_ID,
        name: 'AP Torre Norte',
        macAddress: 'AA:BB:CC:DD:EE:01',
        inInventory: false,
        deviceModelId: MODEL_ID,
        modelName: 'Rocket 5AC Lite',
        vendorId: VENDOR_ID
      });
      expect(prisma.device.findFirst.mock.calls[0][0].where).toEqual({
        id: DEVICE_ID,
        deletedAt: null
      });
    });

    it('should flag a device still in INVENTORY', async () => {
      prisma.device.findFirst.mockResolvedValue(makeRow('INVENTORY'));

      const result = await query.findHardware(
        DeviceId.parse(DEVICE_ID).value
      );

      expect(result.value?.inInventory).toBe(true);
    });

    it('should resolve null for an unknown device', async () => {
      prisma.device.findFirst.mockResolvedValue(null);

      const result = await query.findHardware(
        DeviceId.parse(DEVICE_ID).value
      );

      expect(result.value).toBeNull();
    });

    it('should turn a database error into a failure', async () => {
      prisma.device.findFirst.mockRejectedValue(new Error('boom'));

      const result = await query.findHardware(
        DeviceId.parse(DEVICE_ID).value
      );

      expect(result.error).toContain('boom');
    });
  });

  describe('findPolledHardware', () => {
    it('should read only live devices with an enabled wireless config', async () => {
      prisma.device.findMany.mockResolvedValue([makeRow()]);

      const result = await query.findPolledHardware();

      expect(result.value).toHaveLength(1);
      expect(prisma.device.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        wirelessPollingConfiguration: { enabled: true }
      });
    });

    it('should turn a database error into a failure', async () => {
      prisma.device.findMany.mockRejectedValue(new Error('boom'));

      const result = await query.findPolledHardware();

      expect(result.isFailure).toBe(true);
    });
  });

  describe('findDevicesByMac', () => {
    it('should not query for an empty list', async () => {
      const result = await query.findDevicesByMac([]);

      expect(result.value).toEqual([]);
      expect(prisma.device.findMany).not.toHaveBeenCalled();
    });

    it('should return live devices holding any of the MACs', async () => {
      prisma.device.findMany.mockResolvedValue([
        {
          id: DEVICE_ID,
          name: 'AP Torre Norte',
          macAddress: 'AA:BB:CC:DD:EE:01'
        }
      ]);

      const result = await query.findDevicesByMac([
        'AA:BB:CC:DD:EE:01'
      ]);

      expect(result.value).toEqual([
        {
          deviceId: DEVICE_ID,
          name: 'AP Torre Norte',
          macAddress: 'AA:BB:CC:DD:EE:01'
        }
      ]);
      expect(prisma.device.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        macAddress: { in: ['AA:BB:CC:DD:EE:01'] }
      });
    });
  });

  describe('findCatalogModels', () => {
    it('should list every catalog model', async () => {
      const rows = [
        {
          id: MODEL_ID,
          model: 'Rocket 5AC Lite',
          vendorId: VENDOR_ID
        }
      ];
      prisma.deviceModel.findMany.mockResolvedValue(rows);

      const result = await query.findCatalogModels();

      expect(result.value).toEqual(rows);
    });

    it('should turn a database error into a failure', async () => {
      prisma.deviceModel.findMany.mockRejectedValue(
        new Error('boom')
      );

      const result = await query.findCatalogModels();

      expect(result.isFailure).toBe(true);
    });
  });

  describe('findConfirmedModelNames', () => {
    it('should return the rows the database reports', async () => {
      const rows = [
        { reportedModel: 'LBE-5AC-Gen2', deviceModelId: MODEL_ID }
      ];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await query.findConfirmedModelNames();

      expect(result.value).toEqual(rows);
    });

    it('should turn a database error into a failure', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('boom'));

      const result = await query.findConfirmedModelNames();

      expect(result.error).toContain('boom');
    });
  });
});
