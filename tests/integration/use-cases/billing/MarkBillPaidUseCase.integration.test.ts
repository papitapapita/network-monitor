// Source: src/application/billing/use-cases/MarkBillPaidUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { MarkBillPaidUseCase } from 'application/billing/use-cases';
import { PrismaBillRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanCustomers,
  createTestPrisma,
  seedActiveContractedService,
  seedCustomer,
  seedServicePlan
} from '../../helpers/db';

const USER_ID = '6a1f3c2e-8b4d-4e7f-9a0b-1c2d3e4f5a6b';
const GHOST_ID = '00000000-0000-4000-8000-000000000000';

describe('MarkBillPaidUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: MarkBillPaidUseCase;
  let billId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new MarkBillPaidUseCase(
      new PrismaBillRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanCustomers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    const planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
    const customerId = await seedCustomer(prisma, {
      phone: '3000000001'
    });
    const serviceId = await seedActiveContractedService(
      prisma,
      customerId,
      planId
    );
    const bill = await prisma.bill.create({
      data: {
        customerId,
        periodYear: 2026,
        periodMonth: 9,
        status: 'OVERDUE',
        issueDate: new Date('2026-09-10T11:00:00.000Z'),
        dueDate: new Date('2026-09-16T04:59:59.999Z'),
        lineItems: {
          create: {
            contractedServiceId: serviceId,
            servicePlanId: planId,
            planName: 'Plan 50',
            monthlyPrice: 80000,
            amount: 80000
          }
        }
      }
    });
    billId = bill.id;
  });

  it('[BIL-300] stores the payment beside the bill and marks it paid on the payment date', async () => {
    const result = await useCase.execute({
      id: billId,
      method: 'DAVIPLATA',
      reference: 'D-77',
      paidAt: '2026-09-18T20:00:00.000Z',
      recordedByUserId: USER_ID
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.bill.findUniqueOrThrow({
      where: { id: billId },
      include: { payment: true }
    });
    expect(row.status).toBe('PAID');
    expect(row.paidAt).toEqual(new Date('2026-09-18T20:00:00.000Z'));
    expect(row.payment).toMatchObject({
      method: 'DAVIPLATA',
      reference: 'D-77',
      paidAt: new Date('2026-09-18T20:00:00.000Z'),
      recordedByUserId: USER_ID
    });
    expect(Number(row.payment!.amount)).toBe(80000);
  });

  it('[BIL-300] a second payment is refused and the first stays as it was', async () => {
    await useCase.execute({ id: billId, method: 'CASH' });

    const second = await useCase.execute({
      id: billId,
      method: 'NEQUI'
    });

    expect(second.error).toBe('Cannot mark a PAID bill as paid');
    const payments = await prisma.billPayment.findMany();
    expect(payments).toHaveLength(1);
    expect(payments[0].method).toBe('CASH');
  });

  it('[BIL-301] refuses part of the total and stores nothing', async () => {
    const result = await useCase.execute({
      id: billId,
      method: 'CASH',
      amount: 50000
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.billPayment.count()).toBe(0);
    const row = await prisma.bill.findUniqueOrThrow({
      where: { id: billId }
    });
    expect(row.status).toBe('OVERDUE');
  });

  it('[BIL-303] deleting the bill deletes its payment', async () => {
    await useCase.execute({ id: billId, method: 'CASH' });

    await prisma.bill.delete({ where: { id: billId } });

    expect(await prisma.billPayment.count()).toBe(0);
  });

  it('fails for an unknown bill', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      method: 'CASH'
    });

    expect(result.error).toBe(`Bill not found: ${GHOST_ID}`);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      id: 'nope',
      method: 'CASH'
    });

    expect(result.error).toContain('Invalid bill ID');
  });
});
