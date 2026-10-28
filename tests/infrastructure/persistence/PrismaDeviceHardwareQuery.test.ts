// Source: src/infrastructure/persistence/PrismaDeviceHardwareQuery.ts

import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaDeviceHardwareQuery } from '../../../src/infrastructure/persistence/PrismaDeviceHardwareQuery';
import { DeviceId } from '../../../src/domain/shared/ids';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440001';
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440010';
const VENDOR_ID = '550e8400-e29b-41d4-a716-446655440020';

function makeFakePrismaClient() {
  return {
    device: { findFirst: jest.fn(), findMany: jest.fn() },
    deviceModel: { findMany: jest.fn() },
    routerSystemState: { findMany: jest.fn() },
    $queryRaw: jest.fn()
  };
}

function makeRow(status = 'ACTIVE') {
  return {
    id: DEVICE_ID,
    name: 'AP Torre Norte',
    macAddress: 'AA:BB:CC:DD:EE:01',
    serialNumber: null,
    status,
    deviceModel: {
      id: MODEL_ID,
      model: 'Rocket 5AC Lite',
      vendorId: VENDOR_ID
    }
  };
}

describe('[WLS-152] [DEV-215] PrismaDeviceHardwareQuery', () => {
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
        serialNumber: null,
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

  describe('findReportedHardware', () => {
    const ROUTER_ID = '550e8400-e29b-41d4-a716-446655440002';
    const AT = new Date('2026-10-28T15:00:00Z');

    beforeEach(() => {
      prisma.device.findMany.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.routerSystemState.findMany.mockResolvedValue([]);
    });

    it('[WLS-154] should pair each polled radio with its latest snapshot', async () => {
      prisma.device.findMany.mockResolvedValue([makeRow()]);
      prisma.$queryRaw.mockResolvedValue([
        {
          deviceId: DEVICE_ID,
          macAddress: 'AA:BB:CC:DD:EE:09',
          deviceModel: 'LBE-5AC-Gen2',
          collectedAt: AT
        }
      ]);

      const result = await query.findReportedHardware();

      expect(prisma.device.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        wirelessPollingConfiguration: { enabled: true }
      });
      expect(result.value).toEqual([
        {
          hardware: expect.objectContaining({ deviceId: DEVICE_ID }),
          source: 'RADIO',
          reportedAt: AT,
          macAddress: 'AA:BB:CC:DD:EE:09',
          deviceModel: 'LBE-5AC-Gen2',
          serialNumber: null,
          identity: null
        }
      ]);
    });

    it('[WLS-154] should leave out a radio never polled, without querying snapshots for none', async () => {
      const result = await query.findReportedHardware();

      expect(result.value).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('[DEV-215] should add each MikroTik in service with its last reading', async () => {
      prisma.routerSystemState.findMany.mockResolvedValue([
        {
          readAt: AT,
          identity: 'Core-Insetel',
          model: 'RB4011iGS+',
          serialNumber: 'D4440E1A2B3C',
          macAddress: 'DC:2C:6E:00:00:01',
          device: { ...makeRow(), id: ROUTER_ID, name: 'Core' }
        }
      ]);

      const result = await query.findReportedHardware();

      expect(
        prisma.routerSystemState.findMany.mock.calls[0][0].where
      ).toEqual({
        readAt: { not: null },
        device: {
          deletedAt: null,
          status: { in: ['ACTIVE', 'COMMISSIONING'] }
        }
      });
      expect(result.value).toEqual([
        {
          hardware: expect.objectContaining({
            deviceId: ROUTER_ID,
            name: 'Core'
          }),
          source: 'ROUTER',
          reportedAt: AT,
          macAddress: 'DC:2C:6E:00:00:01',
          deviceModel: 'RB4011iGS+',
          serialNumber: 'D4440E1A2B3C',
          identity: 'Core-Insetel'
        }
      ]);
    });

    it('should report a device that is both once, as a radio', async () => {
      prisma.device.findMany.mockResolvedValue([makeRow()]);
      prisma.$queryRaw.mockResolvedValue([
        {
          deviceId: DEVICE_ID,
          macAddress: null,
          deviceModel: null,
          collectedAt: AT
        }
      ]);
      prisma.routerSystemState.findMany.mockResolvedValue([
        {
          readAt: AT,
          identity: null,
          model: null,
          serialNumber: null,
          macAddress: null,
          device: makeRow()
        }
      ]);

      const result = await query.findReportedHardware();

      expect(result.value.map((r) => r.source)).toEqual(['RADIO']);
    });

    it('should turn a database error into a failure', async () => {
      prisma.device.findMany.mockRejectedValue(new Error('boom'));

      const result = await query.findReportedHardware();

      expect(result.isFailure).toBe(true);
    });
  });

  describe('findDevicesBySerial', () => {
    it('should not query for an empty list', async () => {
      const result = await query.findDevicesBySerial([]);

      expect(result.value).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('[DEV-216] should return the rows the database reports', async () => {
      const rows = [
        {
          deviceId: DEVICE_ID,
          name: 'Switch Norte',
          serialNumber: 'HG5094Z'
        }
      ];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await query.findDevicesBySerial(['hg5094z ']);

      expect(result.value).toEqual(rows);
      expect(prisma.$queryRaw.mock.calls[0]).toContainEqual([
        'HG5094Z'
      ]);
    });

    it('should turn a database error into a failure', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('boom'));

      const result = await query.findDevicesBySerial(['X']);

      expect(result.error).toContain('boom');
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
