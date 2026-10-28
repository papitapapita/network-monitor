import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetHardwareChangesUseCase } from 'application/wireless-monitoring/use-cases/GetHardwareChangesUseCase';
import { HardwareChangeAssessor } from 'application/wireless-monitoring/services';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { PrismaDeviceHardwareQuery } from 'infrastructure/wireless-monitoring/queries';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedWirelessDeviceModel
} from '../../helpers/db';

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
      new PrismaWirelessSnapshotRepository(prisma),
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
});
