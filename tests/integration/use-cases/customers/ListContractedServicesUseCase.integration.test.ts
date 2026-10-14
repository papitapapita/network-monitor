// Source: src/application/customers/use-cases/ListContractedServicesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListContractedServicesUseCase } from 'application/customers/use-cases';
import { PrismaContractedServiceDetailQuery } from 'infrastructure/customers/queries';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCustomers,
  cleanCatalog,
  seedCustomer,
  seedServicePlan,
  seedDeviceModel,
  seedDevice,
  seedContractedService,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('ListContractedServicesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListContractedServicesUseCase;

  let customerId: string;
  let servicePlanId: string;
  let modelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new ListContractedServicesUseCase(
      new PrismaContractedServiceDetailQuery(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);
    customerId = await seedCustomer(prisma, {
      fullName: 'Ana Gómez',
      phone: '3001112233'
    });
    servicePlanId = await seedServicePlan(prisma, {
      name: 'Plan 50/10'
    });
    modelId = await seedDeviceModel(prisma);
  });

  describe('[CUS-123] by device', () => {
    it('returns the service on the device with its summaries', async () => {
      const deviceId = await seedDevice(prisma, modelId, {
        name: 'CPE Ana'
      });
      const otherDevice = await seedDevice(prisma, modelId, {
        serialNumber: 'SN-OTHER'
      });
      const id = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { deviceId, status: 'ACTIVE' }
      );
      await seedContractedService(prisma, customerId, servicePlanId, {
        deviceId: otherDevice,
        status: 'ACTIVE'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.isSuccess).toBe(true);
      expect(result.value.total).toBe(1);
      expect(result.value.contractedServices[0]).toMatchObject({
        id,
        deviceId,
        customer: { id: customerId, fullName: 'Ana Gómez' },
        servicePlan: { id: servicePlanId, name: 'Plan 50/10' },
        device: { id: deviceId, name: 'CPE Ana', deletedAt: null }
      });
    });

    it('returns an empty list for a device with no service', async () => {
      const deviceId = await seedDevice(prisma, modelId);

      const result = await useCase.execute({ deviceId });

      expect(result.isSuccess).toBe(true);
      expect(result.value.contractedServices).toEqual([]);
      expect(result.value.total).toBe(0);
    });

    it('returns an empty list for an unknown device id', async () => {
      const result = await useCase.execute({ deviceId: GHOST_ID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.contractedServices).toEqual([]);
    });

    it('[CUS-100] a cancelled service keeps the device, so it is the one returned', async () => {
      const deviceId = await seedDevice(prisma, modelId);
      const cancelledId = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { deviceId, status: 'CANCELLED' }
      );
      const liveId = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { status: 'PENDING' }
      );

      await expect(
        prisma.contractedService.update({
          where: { id: liveId },
          data: { deviceId }
        })
      ).rejects.toThrow();

      const result = await useCase.execute({ deviceId });

      expect(result.value.contractedServices).toHaveLength(1);
      expect(result.value.contractedServices[0]).toMatchObject({
        id: cancelledId,
        status: 'CANCELLED'
      });
    });

    it('shows a soft-deleted device with its deletedAt', async () => {
      const deviceId = await seedDevice(prisma, modelId);
      await seedContractedService(prisma, customerId, servicePlanId, {
        deviceId,
        status: 'CANCELLED'
      });
      const deletedAt = new Date('2026-10-01T12:00:00Z');
      await prisma.device.update({
        where: { id: deviceId },
        data: { deletedAt }
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.contractedServices[0].device).toMatchObject(
        {
          id: deviceId,
          deletedAt: deletedAt.toISOString()
        }
      );
    });

    it('[CUS-105] a hard-deleted device leaves no trace to filter by', async () => {
      const deviceId = await seedDevice(prisma, modelId);
      const id = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { deviceId, status: 'CANCELLED' }
      );
      await prisma.device.delete({ where: { id: deviceId } });

      const byDevice = await useCase.execute({ deviceId });
      const byCustomer = await useCase.execute({ customerId });

      expect(byDevice.value.contractedServices).toEqual([]);
      expect(byCustomer.value.contractedServices[0]).toMatchObject({
        id,
        deviceId: null,
        device: null
      });
    });

    it('combines with customerId', async () => {
      const deviceId = await seedDevice(prisma, modelId);
      await seedContractedService(prisma, customerId, servicePlanId, {
        deviceId
      });
      const otherCustomer = await seedCustomer(prisma, {
        phone: '3009998877'
      });

      const match = await useCase.execute({ customerId, deviceId });
      const mismatch = await useCase.execute({
        customerId: otherCustomer,
        deviceId
      });

      expect(match.value.total).toBe(1);
      expect(mismatch.value.total).toBe(0);
    });

    it('fails on a malformed device id', async () => {
      const result = await useCase.execute({ deviceId: INVALID_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid deviceId');
    });
  });

  describe('[CUS-122] by customer', () => {
    it('returns every service, newest start first, unpaged', async () => {
      const older = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { status: 'CANCELLED', startDate: new Date('2025-01-01') }
      );
      const newer = await seedContractedService(
        prisma,
        customerId,
        servicePlanId,
        { startDate: new Date('2026-01-01') }
      );

      const result = await useCase.execute({ customerId, limit: 1 });

      expect(
        result.value.contractedServices.map((s) => s.id)
      ).toEqual([newer, older]);
      expect(result.value.hasMore).toBe(false);
    });
  });

  describe('[CUS-120] unfiltered', () => {
    it('pages and embeds summaries', async () => {
      for (let i = 0; i < 3; i++) {
        await seedContractedService(
          prisma,
          customerId,
          servicePlanId
        );
      }

      const result = await useCase.execute({ limit: 2, offset: 0 });

      expect(result.value.contractedServices).toHaveLength(2);
      expect(result.value).toMatchObject({ total: 3, hasMore: true });
      expect(result.value.contractedServices[0].customer.id).toBe(
        customerId
      );
      expect(result.value.contractedServices[0].device).toBeNull();
    });
  });
});
