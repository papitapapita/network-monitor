// Source: src/application/customers/use-cases/GetContractedServiceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetContractedServiceUseCase } from 'application/customers/use-cases';
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

describe('GetContractedServiceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetContractedServiceUseCase;

  let customerId: string;
  let servicePlanId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new GetContractedServiceUseCase(
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
      phone: '3001112233',
      email: 'ana@example.com',
      cedula: '1020304050'
    });
    servicePlanId = await seedServicePlan(prisma, {
      name: 'Plan 50/10',
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: 80000
    });
  });

  it('[CUS-124] embeds the customer, plan and device', async () => {
    const modelId = await seedDeviceModel(prisma);
    const deviceId = await seedDevice(prisma, modelId, {
      name: 'CPE Ana'
    });
    const id = await seedContractedService(
      prisma,
      customerId,
      servicePlanId,
      { deviceId, status: 'ACTIVE' }
    );

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      id,
      customerId,
      servicePlanId,
      deviceId,
      status: 'ACTIVE',
      customer: {
        id: customerId,
        fullName: 'Ana Gómez',
        phone: '3001112233',
        email: 'ana@example.com',
        cedula: '1020304050'
      },
      servicePlan: {
        id: servicePlanId,
        name: 'Plan 50/10',
        downloadMbps: 50,
        uploadMbps: 10,
        monthlyPrice: 80000,
        isActive: true
      },
      device: {
        id: deviceId,
        name: 'CPE Ana',
        ipAddress: null,
        macAddress: null,
        status: 'INVENTORY',
        category: null,
        deletedAt: null
      }
    });
  });

  it('[CUS-124] device is null when the service has no device', async () => {
    const id = await seedContractedService(
      prisma,
      customerId,
      servicePlanId
    );

    const result = await useCase.execute({ id });

    expect(result.value.deviceId).toBeNull();
    expect(result.value.device).toBeNull();
  });

  it('fails with not found for an unknown id', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid contracted service ID');
  });
});
