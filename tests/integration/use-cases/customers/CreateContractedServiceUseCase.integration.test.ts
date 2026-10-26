// Source: src/application/customers/use-cases/CreateContractedServiceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateContractedServiceUseCase } from 'application/customers/use-cases';
import {
  PrismaContractedServiceRepository,
  PrismaCustomerRepository,
  PrismaServicePlanRepository
} from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCatalog,
  cleanCustomers,
  seedCustomer,
  seedServicePlan,
  GHOST_ID
} from '../../helpers/db';

describe('CreateContractedServiceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateContractedServiceUseCase;
  let customerId: string;
  let servicePlanId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new CreateContractedServiceUseCase(
      new PrismaContractedServiceRepository(prisma),
      new PrismaCustomerRepository(prisma),
      new PrismaServicePlanRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);
    customerId = await seedCustomer(prisma);
    servicePlanId = await seedServicePlan(prisma);
  });

  it('persists a PENDING service', async () => {
    const result = await useCase.execute({
      customerId,
      servicePlanId
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.contractedService.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.customerId).toBe(customerId);
    expect(row.status).toBe('PENDING');
  });

  it('[CUS-025] stores the 30th when no payment day is given', async () => {
    const result = await useCase.execute({
      customerId,
      servicePlanId
    });

    const row = await prisma.contractedService.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.paymentDay).toBe(30);
  });

  it('[CUS-024] two services of one customer keep their own payment days', async () => {
    const first = await useCase.execute({
      customerId,
      servicePlanId,
      paymentDay: 15
    });
    const second = await useCase.execute({
      customerId,
      servicePlanId,
      paymentDay: 30
    });

    const rows = await prisma.contractedService.findMany({
      where: { id: { in: [first.value.id, second.value.id] } }
    });
    expect(
      Object.fromEntries(rows.map((r) => [r.id, r.paymentDay]))
    ).toEqual({ [first.value.id]: 15, [second.value.id]: 30 });
  });

  it('[CUS-024] stores nothing for a payment day outside 15 and 30', async () => {
    const result = await useCase.execute({
      customerId,
      servicePlanId,
      paymentDay: 20
    });

    expect(result.error).toBe('Payment day must be one of 15, 30');
    expect(await prisma.contractedService.count()).toBe(0);
  });

  it('[CUS-024] the database refuses a payment day outside 15 and 30', async () => {
    await expect(
      prisma.contractedService.create({
        data: {
          customerId,
          servicePlanId,
          startDate: new Date(),
          paymentDay: 20
        }
      })
    ).rejects.toThrow(/contracted_services_payment_day_check/);
  });

  it('fails for an unknown customer', async () => {
    const result = await useCase.execute({
      customerId: GHOST_ID,
      servicePlanId
    });

    expect(result.error).toMatch(/Customer not found/);
    expect(await prisma.contractedService.count()).toBe(0);
  });

  it('fails for a malformed customer id', async () => {
    const result = await useCase.execute({
      customerId: 'not-a-uuid',
      servicePlanId
    });

    expect(result.error).toMatch(/Invalid customerId/);
  });
});
