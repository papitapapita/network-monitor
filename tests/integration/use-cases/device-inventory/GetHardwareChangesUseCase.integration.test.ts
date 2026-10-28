// Source: src/application/device-inventory/use-cases/GetHardwareChangesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetHardwareChangesUseCase } from 'application/device-inventory/use-cases/GetHardwareChangesUseCase';
import { HardwareChangeAssessor } from 'application/device-inventory/services';
import { PrismaDeviceHardwareQuery } from 'infrastructure/persistence/PrismaDeviceHardwareQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedWirelessDeviceModel
} from '../../helpers/db';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

// A MikroTik in inventory with the serial on file, and what it last said
// about itself (MON-161).
async function seedReportingRouter(
  prisma: PrismaClient,
  opts: {
    name: string;
    serialOnFile: string | null;
    reported: {
      identity?: string | null;
      serialNumber?: string | null;
      model?: string | null;
      macAddress?: string | null;
    };
    status?: 'ACTIVE' | 'INVENTORY';
  }
): Promise<string> {
  const id = await seedRouter(prisma, {
    name: opts.name,
    deviceModelId: await seedMikrotikModel(prisma),
    status: opts.status
  });
  await prisma.device.update({
    where: { id },
    data: { serialNumber: opts.serialOnFile }
  });
  const at = new Date('2026-10-28T15:00:00Z');
  await prisma.routerSystemState.create({
    data: {
      deviceId: id,
      identity: opts.reported.identity ?? opts.name,
      serialNumber: opts.reported.serialNumber ?? null,
      model: opts.reported.model ?? 'mikrotik-ROUTERBOARD',
      macAddress: opts.reported.macAddress ?? null,
      readAt: at,
      attemptedAt: at
    }
  });
  return id;
}

async function seedRadio(
  prisma: PrismaClient,
  deviceModelId: string,
  overrides: {
    name: string;
    macAddress?: string | null;
    status?: 'ACTIVE' | 'INVENTORY';
    wirelessEnabled?: boolean;
    deleted?: boolean;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: overrides.name,
      owner: 'COMPANY',
      status: overrides.status ?? 'ACTIVE',
      monitoringEnabled: true,
      macAddress: overrides.macAddress ?? null,
      deletedAt: overrides.deleted ? new Date() : null,
      deviceModelId
    }
  });
  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      deviceType: 'ACCESS_POINT',
      enabled: overrides.wirelessEnabled ?? true
    }
  });
  return device.id;
}

async function seedReport(
  prisma: PrismaClient,
  deviceId: string,
  report: {
    macAddress?: string | null;
    deviceModel?: string | null;
    collectedAt?: Date;
  }
): Promise<void> {
  await prisma.wirelessSnapshot.create({
    data: {
      deviceId,
      deviceType: 'ACCESS_POINT',
      collectedAt:
        report.collectedAt ?? new Date('2026-10-27T12:00:00Z'),
      collectionMethod: 'http_api',
      macAddress: report.macAddress ?? null,
      deviceModel: report.deviceModel ?? null
    }
  });
}

describe('GetHardwareChangesUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetHardwareChangesUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    const hardwareQuery = new PrismaDeviceHardwareQuery(prisma);
    const logger = new WinstonLogger();
    useCase = new GetHardwareChangesUseCase(
      hardwareQuery,
      new HardwareChangeAssessor(hardwareQuery, logger),
      logger
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  it('returns an empty list when nothing has been polled', async () => {
    await seedRadio(prisma, deviceModelId, { name: 'AP Norte' });

    const result = await useCase.execute();

    expect(result.value).toEqual({ devices: [] });
  });

  it('lists only radios whose latest report differs from inventory', async () => {
    const changed = await seedRadio(prisma, deviceModelId, {
      name: 'AP Norte',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    const same = await seedRadio(prisma, deviceModelId, {
      name: 'AP Sur',
      macAddress: 'AA:BB:CC:DD:EE:02'
    });
    await seedReport(prisma, changed, {
      macAddress: 'AA:BB:CC:DD:EE:01',
      deviceModel: 'LiteBeam 5AC',
      collectedAt: new Date('2026-10-26T12:00:00Z')
    });
    await seedReport(prisma, changed, {
      macAddress: 'AA:BB:CC:DD:EE:99',
      deviceModel: 'Unlisted Radio 5AC'
    });
    await seedReport(prisma, same, {
      macAddress: 'aa:bb:cc:dd:ee:02',
      deviceModel: 'litebeam-5ac'
    });

    const result = await useCase.execute();

    expect(result.value.devices).toEqual([
      {
        deviceId: changed,
        name: 'AP Norte',
        source: 'RADIO',
        collectedAt: '2026-10-27T12:00:00.000Z',
        suggestions: [
          {
            field: 'macAddress',
            currentValue: 'AA:BB:CC:DD:EE:01',
            suggestedValue: 'AA:BB:CC:DD:EE:99',
            currentLabel: null,
            suggestedLabel: null,
            actions: ['REPLACE', 'UPDATE'],
            swapWith: null
          },
          {
            field: 'deviceModel',
            currentValue: deviceModelId,
            suggestedValue: null,
            currentLabel: 'LiteBeam 5AC',
            suggestedLabel: 'Unlisted Radio 5AC',
            actions: ['REPLACE'],
            swapWith: null
          }
        ]
      }
    ]);
  });

  it('pairs two radios that traded places as swaps of each other', async () => {
    const norte = await seedRadio(prisma, deviceModelId, {
      name: 'AP Norte',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    const sur = await seedRadio(prisma, deviceModelId, {
      name: 'AP Sur',
      macAddress: 'AA:BB:CC:DD:EE:02'
    });
    await seedReport(prisma, norte, {
      macAddress: 'AA:BB:CC:DD:EE:02'
    });
    await seedReport(prisma, sur, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute();

    expect(
      result.value.devices.map((d) => ({
        name: d.name,
        actions: d.suggestions[0].actions,
        swapWith: d.suggestions[0].swapWith
      }))
    ).toEqual([
      {
        name: 'AP Norte',
        actions: ['SWAP'],
        swapWith: { deviceId: sur, name: 'AP Sur' }
      },
      {
        name: 'AP Sur',
        actions: ['SWAP'],
        swapWith: { deviceId: norte, name: 'AP Norte' }
      }
    ]);
  });

  it('ignores a MAC held only by a deleted device', async () => {
    const radio = await seedRadio(prisma, deviceModelId, {
      name: 'AP Norte',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedRadio(prisma, deviceModelId, {
      name: 'AP Vieja',
      macAddress: 'AA:BB:CC:DD:EE:99',
      deleted: true
    });
    await seedReport(prisma, radio, {
      macAddress: 'AA:BB:CC:DD:EE:99'
    });

    const result = await useCase.execute();

    expect(result.value.devices[0].suggestions[0]).toMatchObject({
      actions: ['REPLACE', 'UPDATE'],
      swapWith: null
    });
  });

  it('leaves out radios with wireless polling off and deleted radios', async () => {
    const off = await seedRadio(prisma, deviceModelId, {
      name: 'AP Apagada',
      wirelessEnabled: false
    });
    const deleted = await seedRadio(prisma, deviceModelId, {
      name: 'AP Borrada',
      deleted: true
    });
    await seedReport(prisma, off, {
      deviceModel: 'PowerBeam 5AC ISO'
    });
    await seedReport(prisma, deleted, {
      deviceModel: 'PowerBeam 5AC ISO'
    });

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
  });

  it('does not list a radio whose MAC was simply never entered', async () => {
    const radio = await seedRadio(prisma, deviceModelId, {
      name: 'AP Norte',
      macAddress: null
    });
    await seedReport(prisma, radio, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute();

    expect(result.value.devices).toHaveLength(0);
  });

  describe('model names AirOS spells differently (WLS-155)', () => {
    it('does not list a radio that reports the MAC on file under another model name', async () => {
      const radio = await seedRadio(prisma, deviceModelId, {
        name: 'AP Norte',
        macAddress: 'AA:BB:CC:DD:EE:01'
      });
      await seedReport(prisma, radio, {
        macAddress: 'aa-bb-cc-dd-ee-01',
        deviceModel: 'LBE-5AC-Test'
      });

      const result = await useCase.execute();

      expect(result.value.devices).toHaveLength(0);
    });

    it('carries that name over to radios with no MAC on file', async () => {
      const confirmer = await seedRadio(prisma, deviceModelId, {
        name: 'AP Norte',
        macAddress: 'AA:BB:CC:DD:EE:01'
      });
      const noMac = await seedRadio(prisma, deviceModelId, {
        name: 'AP Sur'
      });
      await seedReport(prisma, confirmer, {
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceModel: 'LBE-5AC-Test'
      });
      await seedReport(prisma, noMac, {
        macAddress: 'AA:BB:CC:DD:EE:02',
        deviceModel: 'lbe 5ac test'
      });

      const result = await useCase.execute();

      expect(result.value.devices).toHaveLength(0);
    });

    it('only trusts the latest report of the confirming radio', async () => {
      const confirmer = await seedRadio(prisma, deviceModelId, {
        name: 'AP Norte',
        macAddress: 'AA:BB:CC:DD:EE:01'
      });
      const noMac = await seedRadio(prisma, deviceModelId, {
        name: 'AP Sur'
      });
      await seedReport(prisma, confirmer, {
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceModel: 'LBE-5AC-Test',
        collectedAt: new Date('2026-10-20T12:00:00Z')
      });
      await seedReport(prisma, confirmer, {
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceModel: 'LiteBeam 5AC'
      });
      await seedReport(prisma, noMac, {
        deviceModel: 'LBE-5AC-Test'
      });

      const result = await useCase.execute();

      expect(result.value.devices.map((d) => d.name)).toEqual([
        'AP Sur'
      ]);
    });
  });

  describe('MikroTiks [DEV-215]', () => {
    it('lists a router reporting another serial next to the radios', async () => {
      const radio = await seedRadio(prisma, deviceModelId, {
        name: 'AP Norte',
        macAddress: 'AA:BB:CC:DD:EE:01'
      });
      await seedReport(prisma, radio, {
        macAddress: 'AA:BB:CC:DD:EE:99'
      });
      const core = await seedReportingRouter(prisma, {
        name: 'Core',
        serialOnFile: 'D4440E1A2B3C',
        reported: { serialNumber: 'HG5094Z' }
      });

      const result = await useCase.execute();

      expect(
        result.value.devices.map((d) => [d.name, d.source])
      ).toEqual([
        ['AP Norte', 'RADIO'],
        ['Core', 'ROUTER']
      ]);
      expect(result.value.devices[1]).toMatchObject({
        deviceId: core,
        collectedAt: '2026-10-28T15:00:00.000Z',
        suggestions: [
          {
            field: 'serialNumber',
            currentValue: 'D4440E1A2B3C',
            suggestedValue: 'HG5094Z',
            actions: ['REPLACE', 'UPDATE'],
            swapWith: null
          }
        ]
      });
    });

    it('[DEV-216] offers a swap when the serial is on another record', async () => {
      await seedReportingRouter(prisma, {
        name: 'Core',
        serialOnFile: 'D4440E1A2B3C',
        reported: { serialNumber: 'hg5094z' }
      });
      const other = await seedRouter(prisma, {
        name: 'Switch Norte',
        deviceModelId: await seedMikrotikModel(prisma, 'SWITCH')
      });
      await prisma.device.update({
        where: { id: other },
        data: { serialNumber: 'HG5094Z' }
      });

      const result = await useCase.execute();

      expect(result.value.devices[0]!.suggestions[0]).toMatchObject({
        field: 'serialNumber',
        actions: ['SWAP'],
        swapWith: { deviceId: other, name: 'Switch Norte' }
      });
    });

    it('[DEV-216] lists a router that names itself differently', async () => {
      await seedReportingRouter(prisma, {
        name: 'Core',
        serialOnFile: 'D4440E1A2B3C',
        reported: {
          identity: 'Core-Insetel',
          serialNumber: 'D4440E1A2B3C'
        }
      });

      const result = await useCase.execute();

      expect(result.value.devices[0]!.suggestions).toEqual([
        expect.objectContaining({
          field: 'name',
          currentValue: 'Core',
          suggestedValue: 'Core-Insetel',
          actions: ['UPDATE']
        })
      ]);
    });

    it('leaves out a router whose report matches, and one out of service', async () => {
      await seedReportingRouter(prisma, {
        name: 'Core',
        serialOnFile: 'D4440E1A2B3C',
        reported: { serialNumber: 'd4440e1a2b3c' }
      });
      await seedReportingRouter(prisma, {
        name: 'En bodega',
        serialOnFile: 'AAA',
        reported: { serialNumber: 'BBB' },
        status: 'INVENTORY'
      });

      const result = await useCase.execute();

      expect(result.value.devices).toEqual([]);
    });

    it('[WLS-155] carries a model name confirmed by one router over to another', async () => {
      await seedReportingRouter(prisma, {
        name: 'Core',
        serialOnFile: 'D4440E1A2B3C',
        reported: {
          serialNumber: 'D4440E1A2B3C',
          model: 'RB4011iGS+'
        }
      });
      await seedReportingRouter(prisma, {
        name: 'Borde',
        serialOnFile: null,
        reported: { serialNumber: 'HG5094Z', model: 'RB4011iGS+' }
      });

      const result = await useCase.execute();

      expect(result.value.devices).toEqual([]);
    });
  });
});
