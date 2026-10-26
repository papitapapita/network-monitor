// Source: src/application/customers/use-cases/UpdateContractedServiceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateContractedServiceUseCase } from 'application/customers/use-cases';
import {
  PrismaContractedServiceRepository,
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
  seedContractedService,
  seedCustomer,
  seedServicePlan,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateContractedServiceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateContractedServiceUseCase;
  let customerId: string;
  let servicePlanId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new UpdateContractedServiceUseCase(
      new PrismaContractedServiceRepository(prisma),
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

  async function paymentDayOf(id: string): Promise<number> {
    return (
      await prisma.contractedService.findUniqueOrThrow({
        where: { id }
      })
    ).paymentDay;
  }

  it('[CUS-024] moves a service to the other payment group', async () => {
    const id = await seedContractedService(
      prisma,
      customerId,
      servicePlanId
    );

    const result = await useCase.execute({ id, paymentDay: 15 });

    expect(result.isSuccess).toBe(true);
    expect(await paymentDayOf(id)).toBe(15);
  });

  it("[CUS-024] leaves the customer's other services where they were", async () => {
    const moved = await seedContractedService(
      prisma,
      customerId,
      servicePlanId
    );
    const other = await seedContractedService(
      prisma,
      customerId,
      servicePlanId
    );

    await useCase.execute({ id: moved, paymentDay: 15 });

    expect(await paymentDayOf(other)).toBe(30);
  });

  it('[CUS-024] leaves the row untouched on an invalid payment day', async () => {
    const id = await seedContractedService(
      prisma,
      customerId,
      servicePlanId,
      { paymentDay: 15 }
    );

    const result = await useCase.execute({ id, paymentDay: 31 });

    expect(result.isFailure).toBe(true);
    expect(await paymentDayOf(id)).toBe(15);
  });

  it('keeps the payment day when the status changes', async () => {
    const id = await seedContractedService(
      prisma,
      customerId,
      servicePlanId,
      { paymentDay: 15 }
    );

    await useCase.execute({ id, status: 'CANCELLED' });

    const row = await prisma.contractedService.findUniqueOrThrow({
      where: { id }
    });
    expect(row.status).toBe('CANCELLED');
    expect(row.paymentDay).toBe(15);
  });

  it('fails for an unknown service', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      paymentDay: 15
    });

    expect(result.error).toMatch(/not found/);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      paymentDay: 15
    });

    expect(result.error).toMatch(/Invalid contracted service ID/);
  });
});
