// Source: src/application/device-inventory/use-cases/RetireDeviceAfterCancellationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RetireDeviceAfterCancellationUseCase } from 'application/device-inventory/use-cases';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCustomers,
  cleanCatalog,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('RetireDeviceAfterCancellationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RetireDeviceAfterCancellationUseCase;
  let modelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new RetireDeviceAfterCancellationUseCase(
      new PrismaDeviceRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);
    modelId = await seedDeviceModel(prisma);
  });

  async function seedLiveDevice(
    ownerType: 'COMPANY' | 'CLIENT' | null,
    overrides: {
      status?: 'ACTIVE' | 'DAMAGED';
      ipAddress?: string;
    } = {}
  ): Promise<string> {
    const device = await prisma.device.create({
      data: {
        name: 'CPE Ana',
        deviceModelId: modelId,
        status: overrides.status ?? 'ACTIVE',
        owner: ownerType,
        serialNumber: `SN-${Math.random()}`,
        macAddress: 'AA:BB:CC:DD:EE:01',
        ipAddress: overrides.ipAddress ?? '10.20.0.5',
        monitoringEnabled: overrides.status !== 'DAMAGED'
      }
    });
    return device.id;
  }

  describe('[DEV-173]', () => {
    it('puts a company device back in INVENTORY and frees its IP', async () => {
      const id = await seedLiveDevice('COMPANY');

      const result = await useCase.execute({ deviceId: id });

      expect(result.isSuccess).toBe(true);
      expect(result.value.outcome).toBe('RETIRED');
      const row = await prisma.device.findUniqueOrThrow({
        where: { id }
      });
      expect(row).toMatchObject({
        status: 'INVENTORY',
        monitoringEnabled: false,
        ipAddress: null
      });

      await expect(
        prisma.device.create({
          data: {
            name: 'Next CPE',
            deviceModelId: modelId,
            status: 'ACTIVE',
            serialNumber: 'SN-NEXT',
            ipAddress: '10.20.0.5'
          }
        })
      ).resolves.toBeDefined();
    });

    it('decommissions a device the customer kept', async () => {
      const id = await seedLiveDevice('CLIENT');

      await useCase.execute({ deviceId: id });

      const row = await prisma.device.findUniqueOrThrow({
        where: { id }
      });
      expect(row).toMatchObject({
        status: 'DECOMMISSIONED',
        monitoringEnabled: false,
        ipAddress: null
      });
    });

    it('leaves a device with no owner untouched', async () => {
      const id = await seedLiveDevice(null);

      const result = await useCase.execute({ deviceId: id });

      expect(result.value.outcome).toBe('SKIPPED_NO_OWNER');
      const row = await prisma.device.findUniqueOrThrow({
        where: { id }
      });
      expect(row).toMatchObject({
        status: 'ACTIVE',
        ipAddress: '10.20.0.5'
      });
    });

    it('leaves a DAMAGED device DAMAGED', async () => {
      const id = await seedLiveDevice('COMPANY', {
        status: 'DAMAGED'
      });

      const result = await useCase.execute({ deviceId: id });

      expect(result.value.outcome).toBe('SKIPPED_ALREADY_RETIRED');
      const row = await prisma.device.findUniqueOrThrow({
        where: { id }
      });
      expect(row.status).toBe('DAMAGED');
    });

    it('skips a device in the trash', async () => {
      const id = await seedLiveDevice('COMPANY');
      await prisma.device.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      const result = await useCase.execute({ deviceId: id });

      expect(result.value.outcome).toBe('SKIPPED_NOT_FOUND');
      const row = await prisma.device.findUniqueOrThrow({
        where: { id }
      });
      expect(row.status).toBe('ACTIVE');
    });
  });

  it('skips an unknown device id', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.value.outcome).toBe('SKIPPED_NOT_FOUND');
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });
});
