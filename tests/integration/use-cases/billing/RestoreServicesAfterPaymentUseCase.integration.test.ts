// Source: src/application/billing/use-cases/RestoreServicesAfterPaymentUseCase.ts
// No HTTP surface: RestoreServicesOnPaymentHandler calls it when a bill is paid.

import { PrismaClient } from 'generated/prisma/client';
import { RestoreServicesAfterPaymentUseCase } from 'application/billing/use-cases';
import {
  PrismaBillRepository,
  PrismaBillingSettingsRepository
} from 'infrastructure/billing/repositories';
import { ContractedServiceAccessAdapter } from 'infrastructure/billing/adapters';
import { PrismaContractedServiceRepository } from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanCustomers,
  cleanDatabase,
  createTestPrisma,
  GHOST_ID,
  seedCustomer,
  seedDevice,
  seedDeviceModel,
  seedServicePlan
} from '../../helpers/db';

describe('RestoreServicesAfterPaymentUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: RestoreServicesAfterPaymentUseCase;
  let customerId: string;
  let planId: string;
  let modelId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new RestoreServicesAfterPaymentUseCase(
      new PrismaBillingSettingsRepository(prisma),
      new PrismaBillRepository(prisma),
      new ContractedServiceAccessAdapter(
        new PrismaContractedServiceRepository(prisma)
      ),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
    modelId = await seedDeviceModel(prisma);
    customerId = await seedCustomer(prisma, { phone: '3000000001' });
  });

  async function cutOn(enabled = true): Promise<void> {
    await prisma.billingSettings.create({
      data: {
        automaticBillingEnabled: true,
        billingMode: 'ADVANCE',
        issueLeadDays: 5,
        graceDays: 3,
        automaticCutEnabled: enabled
      }
    });
  }

  async function seedSuspended(
    serial: string | null
  ): Promise<string> {
    const deviceId =
      serial === null
        ? null
        : await seedDevice(prisma, modelId, { serialNumber: serial });
    const service = await prisma.contractedService.create({
      data: {
        customerId,
        servicePlanId: planId,
        deviceId,
        status: 'SUSPENDED',
        startDate: new Date('2026-01-10T15:00:00.000Z')
      }
    });
    return service.id;
  }

  async function seedBill(
    serviceIds: string[],
    status: 'PAID' | 'OVERDUE',
    month: number
  ): Promise<string> {
    const bill = await prisma.bill.create({
      data: {
        customerId,
        periodYear: 2026,
        periodMonth: month,
        status,
        issueDate: new Date('2026-09-10T11:00:00.000Z'),
        dueDate: new Date('2026-09-16T04:59:59.999Z'),
        paidAt:
          status === 'PAID' ? new Date('2026-09-20T15:00:00Z') : null,
        lineItems: {
          create: serviceIds.map((contractedServiceId) => ({
            contractedServiceId,
            servicePlanId: planId,
            planName: 'Plan 50',
            monthlyPrice: 80000,
            amount: 80000
          }))
        }
      }
    });
    return bill.id;
  }

  async function statusOf(id: string): Promise<string> {
    return (
      await prisma.contractedService.findUniqueOrThrow({
        where: { id }
      })
    ).status;
  }

  it("[BIL-311] brings back the paid bill's service and leaves the customer's other service cut", async () => {
    await cutOn();
    const paid = await seedSuspended('SN-PAID');
    const other = await seedSuspended('SN-OTHER');
    const billId = await seedBill([paid], 'PAID', 9);

    const result = await useCase.execute({ billId });

    expect(result.value).toEqual({
      attempted: true,
      restored: 1,
      failed: []
    });
    expect(await statusOf(paid)).toBe('ACTIVE');
    expect(await statusOf(other)).toBe('SUSPENDED');
  });

  it('[BIL-311] keeps the service suspended while another of its bills is overdue', async () => {
    await cutOn();
    const cut = await seedSuspended('SN-CUT');
    const billId = await seedBill([cut], 'PAID', 9);
    await seedBill([cut], 'OVERDUE', 8);

    const result = await useCase.execute({ billId });

    expect(result.value.restored).toBe(0);
    expect(await statusOf(cut)).toBe('SUSPENDED');
  });

  it("[BIL-311] another service's overdue bill does not hold this one back", async () => {
    await cutOn();
    const paid = await seedSuspended('SN-PAID');
    const owing = await seedSuspended('SN-OWING');
    const billId = await seedBill([paid], 'PAID', 9);
    await seedBill([owing], 'OVERDUE', 9);

    await useCase.execute({ billId });

    expect(await statusOf(paid)).toBe('ACTIVE');
    expect(await statusOf(owing)).toBe('SUSPENDED');
  });

  it('[BIL-311] restores nothing while the automatic cut is off', async () => {
    await cutOn(false);
    const cut = await seedSuspended('SN-CUT');
    const billId = await seedBill([cut], 'PAID', 9);

    const result = await useCase.execute({ billId });

    expect(result.value.attempted).toBe(false);
    expect(await statusOf(cut)).toBe('SUSPENDED');
  });

  it('[BIL-311] reports a service on the bill that cannot come back and restores the rest', async () => {
    await cutOn();
    const withDevice = await seedSuspended('SN-CUT');
    const noDevice = await seedSuspended(null);
    const billId = await seedBill([withDevice, noDevice], 'PAID', 9);

    const result = await useCase.execute({ billId });

    expect(result.value.restored).toBe(1);
    expect(result.value.failed).toEqual([
      {
        id: noDevice,
        error:
          'Cannot activate a contracted service without a device assigned'
      }
    ]);
    expect(await statusOf(withDevice)).toBe('ACTIVE');
    expect(await statusOf(noDevice)).toBe('SUSPENDED');
  });

  it('fails for an unknown bill', async () => {
    await cutOn();

    const result = await useCase.execute({ billId: GHOST_ID });

    expect(result.error).toBe(`Bill not found: ${GHOST_ID}`);
  });

  it('fails for a malformed bill id', async () => {
    const result = await useCase.execute({ billId: 'nope' });

    expect(result.error).toContain('Invalid billId');
  });
});
