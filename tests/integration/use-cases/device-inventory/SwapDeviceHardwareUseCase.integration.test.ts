// Source: src/application/device-inventory/use-cases/SwapDeviceHardwareUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { ReplaceDeviceUseCase } from 'application/device-inventory/use-cases/ReplaceDeviceUseCase';
import { SwapDeviceHardwareUseCase } from 'application/device-inventory/use-cases/SwapDeviceHardwareUseCase';
import { IDeviceHardwareSwapRepository } from 'domain/device-inventory/repository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  cleanBills,
  cleanCustomers,
  cleanTickets,
  seedDeviceModel,
  seedWirelessDeviceModel,
  seedLocation,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

const MAC_A = 'AA:BB:CC:DD:EE:0A';
const MAC_B = 'AA:BB:CC:DD:EE:0B';
const MAC_MOVED = 'AA:BB:CC:DD:EE:99';

describe('SwapDeviceHardwareUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceRepo: PrismaDeviceRepository;
  let createUseCase: CreateDeviceUseCase;
  let replaceUseCase: ReplaceDeviceUseCase;
  let swapUseCase: SwapDeviceHardwareUseCase;
  let wiredModelId: string;
  let bigModelId: string;
  let smallModelId: string;
  let locationId: string;

  function buildSwapUseCase(
    hardwareSwapRepository: IDeviceHardwareSwapRepository = deviceRepo
  ): SwapDeviceHardwareUseCase {
    return new SwapDeviceHardwareUseCase(
      deviceRepo,
      hardwareSwapRepository,
      new PrismaDeviceModelRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      new WinstonLogger()
    );
  }

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    wiredModelId = await seedDeviceModel(prisma);
    bigModelId = await seedWirelessDeviceModel(prisma);

    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { slug: 'ubiquiti' }
    });
    const small = await prisma.deviceModel.upsert({
      where: {
        vendorId_model: {
          vendorId: vendor.id,
          model: 'NanoStation 5AC'
        }
      },
      update: {},
      create: {
        vendorId: vendor.id,
        model: 'NanoStation 5AC',
        deviceType: 'ANTENNA',
        isWireless: true
      }
    });
    smallModelId = small.id;

    deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      deviceRepo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    replaceUseCase = new ReplaceDeviceUseCase(
      deviceRepo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      new PrismaContractedServiceRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      logger
    );
    swapUseCase = buildSwapUseCase();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId: bigModelId,
      name: 'AP-Site-A',
      ownerType: 'COMPANY',
      category: 'ACCESS_POINT',
      serialNumber: 'SN-BIG-001',
      macAddress: MAC_A,
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.70.0.1',
      monitoringEnabled: true,
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // The big antenna at site A and the small one at site B, as in the field.
  async function createPair(): Promise<{ aId: string; bId: string }> {
    const aId = await createDevice();
    const bId = await createDevice({
      deviceModelId: smallModelId,
      name: 'AP-Site-B',
      serialNumber: 'SN-SMALL-002',
      macAddress: MAC_B,
      ipAddress: '10.70.0.2'
    });
    return { aId, bId };
  }

  async function row(id: string) {
    return prisma.device.findUniqueOrThrow({ where: { id } });
  }

  // Everything a swap may or may not touch, minus timestamps that a real
  // write is entitled to move.
  async function snapshot(...ids: string[]) {
    return Promise.all(ids.map((id) => row(id)));
  }

  // ──────────────────────────────────────────────────────────────
  // What moves
  // ──────────────────────────────────────────────────────────────

  it('exchanges model, serial number and MAC between the two rows', async () => {
    const { aId, bId } = await createPair();

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isSuccess).toBe(true);

    const a = await row(aId);
    const b = await row(bId);
    expect(a.deviceModelId).toBe(smallModelId);
    expect(a.serialNumber).toBe('SN-SMALL-002');
    expect(a.macAddress).toBe(MAC_B);
    expect(b.deviceModelId).toBe(bigModelId);
    expect(b.serialNumber).toBe('SN-BIG-001');
    expect(b.macAddress).toBe(MAC_A);
  });

  it('reports the swapped state in the response, each side under its own id', async () => {
    const { aId, bId } = await createPair();

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.value.device).toMatchObject({
      id: aId,
      deviceModelId: smallModelId,
      serialNumber: 'SN-SMALL-002',
      macAddress: MAC_B
    });
    expect(result.value.otherDevice).toMatchObject({
      id: bId,
      deviceModelId: bigModelId,
      serialNumber: 'SN-BIG-001',
      macAddress: MAC_A
    });
  });

  it('bumps updated_at on both rows', async () => {
    const { aId, bId } = await createPair();
    const past = new Date('2020-01-01T00:00:00.000Z');
    await prisma.device.updateMany({
      where: { id: { in: [aId, bId] } },
      data: { updatedAt: past }
    });

    await swapUseCase.execute({ id: aId, otherDeviceId: bId });

    expect((await row(aId)).updatedAt.getTime()).toBeGreaterThan(
      past.getTime()
    );
    expect((await row(bId)).updatedAt.getTime()).toBeGreaterThan(
      past.getTime()
    );
  });

  it('is its own inverse: swapping twice restores the original state', async () => {
    const { aId, bId } = await createPair();
    const [aBefore, bBefore] = await snapshot(aId, bId);

    await swapUseCase.execute({ id: aId, otherDeviceId: bId });
    await swapUseCase.execute({ id: bId, otherDeviceId: aId });

    const [aAfter, bAfter] = await snapshot(aId, bId);
    expect(aAfter).toMatchObject({
      deviceModelId: aBefore.deviceModelId,
      serialNumber: aBefore.serialNumber,
      macAddress: aBefore.macAddress
    });
    expect(bAfter).toMatchObject({
      deviceModelId: bBefore.deviceModelId,
      serialNumber: bBefore.serialNumber,
      macAddress: bBefore.macAddress
    });
  });

  it('swaps a device that has no MAC with one that does', async () => {
    const aId = await createDevice({ macAddress: null });
    const bId = await createDevice({
      deviceModelId: smallModelId,
      name: 'AP-Site-B',
      serialNumber: 'SN-SMALL-002',
      macAddress: MAC_B,
      ipAddress: '10.70.0.2'
    });

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isSuccess).toBe(true);
    const a = await row(aId);
    const b = await row(bId);
    expect(a.macAddress).toBe(MAC_B);
    expect(a.serialNumber).toBe('SN-SMALL-002');
    expect(b.macAddress).toBeNull();
    expect(b.serialNumber).toBe('SN-BIG-001');
  });

  // ──────────────────────────────────────────────────────────────
  // What stays with the site
  // ──────────────────────────────────────────────────────────────

  it('leaves IP, location, status, monitoring and identity of the record alone', async () => {
    const { aId, bId } = await createPair();
    const [aBefore, bBefore] = await snapshot(aId, bId);

    await swapUseCase.execute({ id: aId, otherDeviceId: bId });

    for (const [before, id] of [
      [aBefore, aId],
      [bBefore, bId]
    ] as const) {
      const after = await row(id);
      expect(after).toMatchObject({
        name: before.name,
        ipAddress: before.ipAddress,
        locationId: before.locationId,
        status: before.status,
        category: before.category,
        owner: before.owner,
        monitoringEnabled: before.monitoringEnabled,
        replacesDeviceId: before.replacesDeviceId,
        deletedAt: before.deletedAt
      });
    }
  });

  it('keeps credentials, contracted service, wireless config and history on the same device ids', async () => {
    const { aId, bId } = await createPair();

    // A bare row: a swap never decrypts credentials, so going through the
    // repository would only add a dependency on DEVICE_CREDENTIALS_KEY.
    await prisma.deviceCredentials.create({
      data: { deviceId: aId }
    });

    const customerId = await seedCustomer(prisma);
    const servicePlanId = await seedServicePlan(prisma);
    const serviceId = await seedActiveContractedService(
      prisma,
      customerId,
      servicePlanId,
      { deviceId: aId }
    );
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: aId,
        ipAddress: '10.70.0.1',
        enabled: true,
        intervalSecs: 3600,
        deviceType: 'ACCESS_POINT'
      }
    });
    await prisma.pingResult.create({
      data: { deviceId: aId, isReachable: true, latencyMs: 12 }
    });

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isSuccess).toBe(true);
    expect(
      await prisma.deviceCredentials.findUnique({
        where: { deviceId: aId }
      })
    ).not.toBeNull();
    expect(
      await prisma.deviceCredentials.findUnique({
        where: { deviceId: bId }
      })
    ).toBeNull();
    expect(
      (await prisma.contractedService.findUnique({
        where: { id: serviceId }
      }))!.deviceId
    ).toBe(aId);
    expect(
      await prisma.wirelessPollingConfiguration.count({
        where: { deviceId: aId }
      })
    ).toBe(1);
    expect(
      await prisma.pingResult.count({ where: { deviceId: aId } })
    ).toBe(1);
    expect(
      await prisma.pingResult.count({ where: { deviceId: bId } })
    ).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Atomicity against the live MAC index
  // ──────────────────────────────────────────────────────────────

  it('rolls back both rows when the last write hits the MAC index', async () => {
    const { aId, bId } = await createPair();

    // Steps one and two of the transaction succeed; step three collides with
    // a third device that took B's old MAC after the use case had loaded both
    // aggregates. Without a transaction A would be left with no MAC at all
    // and B with A's.
    const racing: IDeviceHardwareSwapRepository = {
      saveHardwareSwap: async (first, second) => {
        await prisma.device.update({
          where: { id: bId },
          data: { macAddress: MAC_MOVED }
        });
        const third = await createUseCase.execute({
          deviceModelId: wiredModelId,
          name: 'Interloper',
          ownerType: 'COMPANY',
          serialNumber: 'SN-THIRD-003',
          macAddress: MAC_B
        });
        expect(third.isSuccess).toBe(true);
        return deviceRepo.saveHardwareSwap(first, second);
      }
    };
    const aBefore = await row(aId);

    const result = await buildSwapUseCase(racing).execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already assigned/i);

    const a = await row(aId);
    const b = await row(bId);
    expect(a.macAddress).toBe(MAC_A);
    expect(a.macAddress).not.toBeNull();
    expect(a.serialNumber).toBe(aBefore.serialNumber);
    expect(a.deviceModelId).toBe(bigModelId);
    expect(b.macAddress).toBe(MAC_MOVED);
    expect(b.serialNumber).toBe('SN-SMALL-002');
    expect(b.deviceModelId).toBe(smallModelId);
  });

  it('fails and leaves the surviving row intact when the other disappears before the write', async () => {
    const { aId, bId } = await createPair();

    const vanishing: IDeviceHardwareSwapRepository = {
      saveHardwareSwap: async (first, second) => {
        await prisma.device.delete({ where: { id: bId } });
        return deviceRepo.saveHardwareSwap(first, second);
      }
    };

    const result = await buildSwapUseCase(vanishing).execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);

    const a = await row(aId);
    expect(a.macAddress).toBe(MAC_A);
    expect(a.serialNumber).toBe('SN-BIG-001');
    expect(a.deviceModelId).toBe(bigModelId);
  });

  // ──────────────────────────────────────────────────────────────
  // Refusals leave the database untouched
  // ──────────────────────────────────────────────────────────────

  it('refuses to swap a device with itself', async () => {
    const { aId, bId } = await createPair();
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: aId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/with itself/i);
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  it('refuses when both devices carry identical hardware details', async () => {
    const aId = await createDevice({
      serialNumber: null,
      macAddress: null
    });
    const bId = await createDevice({
      name: 'AP-Site-B',
      serialNumber: null,
      macAddress: null,
      ipAddress: '10.70.0.2'
    });
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/identical hardware/i);
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  it.each(['first', 'second'] as const)(
    'treats a soft-deleted device as not found (%s position)',
    async (position) => {
      const { aId, bId } = await createPair();
      const deletedId = position === 'first' ? aId : bId;
      await prisma.device.update({
        where: { id: deletedId },
        data: { deletedAt: new Date(), monitoringEnabled: false }
      });
      const before = await snapshot(aId, bId);

      const result = await swapUseCase.execute({
        id: aId,
        otherDeviceId: bId
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/device not found/i);
      expect(await snapshot(aId, bId)).toEqual(before);
    }
  );

  it('refuses a device that was replaced and is still retired', async () => {
    const { aId, bId } = await createPair();
    const replaced = await replaceUseCase.execute({
      id: aId,
      deviceModelId: bigModelId,
      retiredStatus: 'DAMAGED',
      serialNumber: 'SN-NEW-009',
      macAddress: 'AA:BB:CC:DD:EE:09'
    });
    expect(replaced.isSuccess).toBe(true);
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already been replaced/i);
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  it('refuses when a device holding a wireless config would receive a model with no radio', async () => {
    const aId = await createDevice({ category: 'WIRELESS_CPE' });
    const bId = await createDevice({
      deviceModelId: wiredModelId,
      category: 'GATEWAY',
      name: 'Router-Site-B',
      serialNumber: 'SN-WIRED-002',
      macAddress: MAC_B,
      ipAddress: '10.70.0.2'
    });
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: aId,
        ipAddress: '10.70.0.1',
        enabled: true,
        intervalSecs: 3600,
        deviceType: 'STATION'
      }
    });
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no radio/i);
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  it('allows the swap when the wireless config lands on another wireless model', async () => {
    const { aId, bId } = await createPair();
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: aId,
        ipAddress: '10.70.0.1',
        enabled: true,
        intervalSecs: 3600,
        deviceType: 'ACCESS_POINT'
      }
    });

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isSuccess).toBe(true);
  });

  it('refuses to hand a retired device an empty identity', async () => {
    const aId = await createDevice({
      serialNumber: null,
      macAddress: null
    });
    const bId = await createDevice({
      deviceModelId: smallModelId,
      name: 'Shelf-Unit',
      status: 'DAMAGED',
      serialNumber: 'SN-DMG-002',
      macAddress: null,
      ipAddress: null,
      monitoringEnabled: false
    });
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /must have at least a serial number or MAC address/i
    );
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  // ──────────────────────────────────────────────────────────────
  // Lookup failures
  // ──────────────────────────────────────────────────────────────

  it('fails when the first device does not exist (GHOST_ID)', async () => {
    const { bId } = await createPair();

    const result = await swapUseCase.execute({
      id: GHOST_ID,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device not found/i);
  });

  it('fails when the second device does not exist (GHOST_ID)', async () => {
    const { aId, bId } = await createPair();
    const before = await snapshot(aId, bId);

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device not found/i);
    expect(await snapshot(aId, bId)).toEqual(before);
  });

  it('fails with a malformed first id', async () => {
    const { bId } = await createPair();

    const result = await swapUseCase.execute({
      id: INVALID_ID,
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails with a malformed second id', async () => {
    const { aId } = await createPair();

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: INVALID_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails with an empty id', async () => {
    const { bId } = await createPair();

    const result = await swapUseCase.execute({
      id: '',
      otherDeviceId: bId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device id is required/i);
  });

  it('fails with an empty otherDeviceId', async () => {
    const { aId } = await createPair();

    const result = await swapUseCase.execute({
      id: aId,
      otherDeviceId: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/otherDeviceId is required/i);
  });
});
