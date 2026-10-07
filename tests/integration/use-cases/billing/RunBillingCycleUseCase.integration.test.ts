// Source: src/application/billing/use-cases/RunBillingCycleUseCase.ts
// No HTTP surface: the daily BillingCycleOrchestrator is its only caller.

import { PrismaClient } from 'generated/prisma/client';
import {
  GenerateBillUseCase,
  GetBillPdfUseCase,
  RunBillingCycleUseCase,
  SendBillEmailUseCase,
  SendBillWhatsAppUseCase,
  SendPaymentRemindersUseCase
} from 'application/billing/use-cases';
import { PdfKitBillPdfRenderer } from 'infrastructure/billing/services';
import { FakeEmailSender } from '../../helpers/FakeEmailSender';
import { FakeCustomerWhatsApp } from '../../helpers/FakeCustomerWhatsApp';
import {
  PrismaBillRepository,
  PrismaBillReminderLog,
  PrismaBillingSettingsRepository
} from 'infrastructure/billing/repositories';
import {
  PrismaBillableCustomersQuery,
  PrismaBillingContactsQuery
} from 'infrastructure/billing/queries';
import { ContractedServiceAccessAdapter } from 'infrastructure/billing/adapters';
import {
  PrismaCustomerRepository,
  PrismaContractedServiceRepository,
  PrismaServicePlanRepository
} from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanCustomers,
  createTestPrisma,
  seedActiveContractedService,
  seedCustomer,
  seedServicePlan
} from '../../helpers/db';

// 06:00 on 12 Oct in Bogotá: the 15th group's window is open, the 30th's not.
const NOW = new Date('2026-10-12T11:00:00.000Z');
const DUE_15_OCT = new Date('2026-10-16T04:59:59.999Z');
const LONG_AGO = new Date('2026-01-10T15:00:00.000Z');

describe('RunBillingCycleUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: RunBillingCycleUseCase;
  let planId: string;
  let email: FakeEmailSender;
  let whatsApp: FakeCustomerWhatsApp;

  beforeAll(() => {
    prisma = createTestPrisma();
    const logger = new WinstonLogger();
    const billRepository = new PrismaBillRepository(prisma);
    const customerRepository = new PrismaCustomerRepository(prisma);
    const contacts = new PrismaBillingContactsQuery(prisma);
    email = new FakeEmailSender();
    whatsApp = new FakeCustomerWhatsApp();
    const getBillPdf = new GetBillPdfUseCase(
      billRepository,
      customerRepository,
      new PdfKitBillPdfRenderer(),
      logger
    );
    useCase = new RunBillingCycleUseCase(
      new PrismaBillingSettingsRepository(prisma),
      new PrismaBillableCustomersQuery(prisma),
      billRepository,
      new GenerateBillUseCase(
        billRepository,
        customerRepository,
        new PrismaContractedServiceRepository(prisma),
        new PrismaServicePlanRepository(prisma),
        logger
      ),
      new ContractedServiceAccessAdapter(
        new PrismaContractedServiceRepository(prisma)
      ),
      new SendBillEmailUseCase(
        billRepository,
        contacts,
        getBillPdf,
        email,
        logger
      ),
      new SendBillWhatsAppUseCase(
        billRepository,
        contacts,
        getBillPdf,
        whatsApp,
        logger
      ),
      new SendPaymentRemindersUseCase(
        billRepository,
        new PrismaBillReminderLog(prisma),
        contacts,
        email,
        null,
        logger
      ),
      logger
    );
  });

  afterAll(async () => {
    await prisma.billingSettings.deleteMany();
    await cleanCustomers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.billingSettings.deleteMany();
    await cleanCustomers(prisma);
    email.sent = [];
    whatsApp.sent = [];
    planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
  });

  async function enableBilling(
    billingMode: 'ADVANCE' | 'ARREARS' = 'ADVANCE',
    automaticCutEnabled = false,
    billWhatsAppTemplate: string | null = null
  ): Promise<void> {
    await prisma.billingSettings.create({
      data: {
        automaticBillingEnabled: true,
        billingMode,
        issueLeadDays: 5,
        graceDays: 3,
        automaticCutEnabled,
        billWhatsAppTemplate
      }
    });
  }

  async function seedBillable(
    phone: string,
    paymentDay: number,
    startDate: Date = LONG_AGO,
    emailAddress: string | null = null
  ): Promise<string> {
    const customerId = await seedCustomer(prisma, {
      phone,
      paymentDay,
      email: emailAddress
    });
    await seedActiveContractedService(prisma, customerId, planId, {
      startDate
    });
    return customerId;
  }

  async function onlyLine() {
    const bill = await prisma.bill.findFirstOrThrow({
      include: { lineItems: true }
    });
    const line = bill.lineItems[0];
    return {
      period: `${bill.periodYear}-${bill.periodMonth}`,
      amount: Number(line.amount),
      from: line.serviceFrom!.toISOString().slice(0, 10),
      to: line.serviceTo!.toISOString().slice(0, 10)
    };
  }

  async function seedBill(
    customerId: string,
    status: 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE',
    dueDate: Date,
    period = { year: 2026, month: 9 }
  ): Promise<string> {
    const service = await prisma.contractedService.findFirstOrThrow({
      where: { customerId }
    });
    const bill = await prisma.bill.create({
      data: {
        customerId,
        periodYear: period.year,
        periodMonth: period.month,
        status,
        issueDate: new Date('2026-09-10T11:00:00.000Z'),
        dueDate,
        paidAt:
          status === 'PAID' ? new Date('2026-09-12T15:00:00Z') : null,
        lineItems: {
          create: {
            contractedServiceId: service.id,
            servicePlanId: planId,
            planName: 'Plan 50',
            monthlyPrice: 80000,
            amount: 80000
          }
        }
      }
    });
    return bill.id;
  }

  it('[BIL-281] does nothing until automatic billing is turned on', async () => {
    const customerId = await seedBillable('3000000015', 15);
    const pastDue = await seedBill(
      customerId,
      'PENDING',
      new Date('2026-09-16T04:59:59.999Z')
    );

    const result = await useCase.execute({ now: NOW });

    expect(result.value.automaticBillingEnabled).toBe(false);
    expect(await prisma.bill.count()).toBe(1);
    const bill = await prisma.bill.findUniqueOrThrow({
      where: { id: pastDue }
    });
    expect(bill.status).toBe('PENDING');
  });

  it('[BIL-283] issues the bill of a customer whose window is open, due on their day', async () => {
    await enableBilling();
    const customer15 = await seedBillable('3000000015', 15);
    await seedBillable('3000000030', 30);

    const result = await useCase.execute({ now: NOW });

    expect(result.value.generated).toBe(1);
    const bills = await prisma.bill.findMany({
      include: { lineItems: true }
    });
    expect(bills).toHaveLength(1);
    expect(bills[0].customerId).toBe(customer15);
    expect(bills[0].periodYear).toBe(2026);
    expect(bills[0].periodMonth).toBe(10);
    expect(bills[0].status).toBe('PENDING');
    expect(bills[0].issueDate).toEqual(NOW);
    expect(bills[0].dueDate).toEqual(DUE_15_OCT);
    expect(Number(bills[0].lineItems[0].monthlyPrice)).toBe(80000);
    expect(Number(bills[0].lineItems[0].amount)).toBe(80000);
  });

  it('[BIL-288] a service that started inside the billed month is charged from its first day', async () => {
    await enableBilling();
    // 11 Oct in Bogotá: 21 of October's 31 days.
    await seedBillable(
      '3000000015',
      15,
      new Date('2026-10-11T14:00:00.000Z')
    );

    await useCase.execute({ now: NOW });

    expect(await onlyLine()).toMatchObject({
      period: '2026-10',
      amount: 54194,
      from: '2026-10-11',
      to: '2026-10-31'
    });
  });

  it("[BIL-289] in advance, a service started after last month's issue day and never billed also pays last month's days", async () => {
    await enableBilling();
    // 20 Sep: after the 10 Sep issue day; 11 of September's 30 days.
    await seedBillable(
      '3000000015',
      15,
      new Date('2026-09-20T14:00:00.000Z')
    );

    await useCase.execute({ now: NOW });

    expect(await onlyLine()).toMatchObject({
      period: '2026-10',
      amount: 80000 + 29333,
      from: '2026-09-20',
      to: '2026-10-31'
    });
  });

  it("[BIL-289] in advance, last month's days are not charged again when last month's bill holds the service", async () => {
    await enableBilling();
    const customerId = await seedBillable(
      '3000000015',
      15,
      new Date('2026-09-20T14:00:00.000Z')
    );
    await seedBill(
      customerId,
      'PAID',
      new Date('2026-09-16T04:59:59.999Z')
    );

    await useCase.execute({ now: NOW });

    const line = await prisma.billLineItem.findFirstOrThrow({
      where: { bill: { periodMonth: 10 } }
    });
    expect(Number(line.amount)).toBe(80000);
    expect(line.serviceFrom!.toISOString().slice(0, 10)).toBe(
      '2026-10-01'
    );
  });

  it("[BIL-289] in advance, a service started before last month's issue day is charged this month only", async () => {
    await enableBilling();
    await seedBillable(
      '3000000015',
      15,
      new Date('2026-09-05T14:00:00.000Z')
    );

    await useCase.execute({ now: NOW });

    expect(await onlyLine()).toMatchObject({
      amount: 80000,
      from: '2026-10-01'
    });
  });

  it('[BIL-288] paid after use, a service that started inside the billed month is charged from its first day', async () => {
    await enableBilling('ARREARS');
    await seedBillable(
      '3000000015',
      15,
      new Date('2026-09-20T14:00:00.000Z')
    );

    await useCase.execute({ now: NOW });

    expect(await onlyLine()).toMatchObject({
      period: '2026-9',
      amount: 29333,
      from: '2026-09-20',
      to: '2026-09-30'
    });
  });

  it('[BIL-287] paid after use, a service that starts after the billed month waits for the next bill', async () => {
    await enableBilling('ARREARS');
    await seedBillable(
      '3000000015',
      15,
      new Date('2026-10-02T14:00:00.000Z')
    );

    const result = await useCase.execute({ now: NOW });

    expect(result.value.generated).toBe(0);
    expect(result.value.failed).toEqual([]);
    expect(await prisma.bill.count()).toBe(0);
  });

  it('[BIL-282] paid after use, the bill is for the month before', async () => {
    await enableBilling('ARREARS');
    await seedBillable('3000000015', 15);

    await useCase.execute({ now: NOW });

    const bill = await prisma.bill.findFirstOrThrow();
    expect(bill.periodMonth).toBe(9);
    expect(bill.dueDate).toEqual(DUE_15_OCT);
  });

  it('[BIL-284] a second run the same day issues nothing more', async () => {
    await enableBilling();
    await seedBillable('3000000015', 15);

    await useCase.execute({ now: NOW });
    const second = await useCase.execute({
      now: new Date('2026-10-13T11:00:00.000Z')
    });

    expect(second.value.generated).toBe(0);
    expect(second.value.failed).toEqual([]);
    expect(await prisma.bill.count()).toBe(1);
  });

  it('[BIL-284] never re-issues a period whose bill was cancelled', async () => {
    await enableBilling();
    const customerId = await seedBillable('3000000015', 15);
    await seedBill(customerId, 'CANCELLED', DUE_15_OCT, {
      year: 2026,
      month: 10
    });

    const result = await useCase.execute({ now: NOW });

    expect(result.value.generated).toBe(0);
    expect(await prisma.bill.count()).toBe(1);
  });

  it('[BIL-284] skips a customer whose only service is suspended', async () => {
    await enableBilling();
    const customerId = await seedBillable('3000000015', 15);
    await prisma.contractedService.updateMany({
      where: { customerId },
      data: { status: 'SUSPENDED' }
    });

    const result = await useCase.execute({ now: NOW });

    expect(result.value.generated).toBe(0);
    expect(await prisma.bill.count()).toBe(0);
  });

  it('[BIL-286] marks unpaid bills past their due date overdue, and only those', async () => {
    await enableBilling();
    const customerId = await seedBillable('3000000030', 30);
    const pastDue = await seedBill(
      customerId,
      'PENDING',
      new Date('2026-10-01T04:59:59.999Z'),
      { year: 2026, month: 9 }
    );
    const paid = await seedBill(
      customerId,
      'PAID',
      new Date('2026-09-01T04:59:59.999Z'),
      { year: 2026, month: 8 }
    );
    const notYetDue = await seedBill(
      customerId,
      'PENDING',
      new Date('2026-10-31T04:59:59.999Z'),
      { year: 2026, month: 10 }
    );

    const result = await useCase.execute({ now: NOW });

    expect(result.value.markedOverdue).toBe(1);
    const status = async (id: string) =>
      (await prisma.bill.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(pastDue)).toBe('OVERDUE');
    expect(await status(paid)).toBe('PAID');
    expect(await status(notYetDue)).toBe('PENDING');
  });

  describe('[BIL-310] the automatic cut', () => {
    async function serviceStatus(
      customerId: string
    ): Promise<string> {
      const service = await prisma.contractedService.findFirstOrThrow(
        {
          where: { customerId }
        }
      );
      return service.status;
    }

    it('suspends a customer still unpaid after the grace days', async () => {
      await enableBilling('ADVANCE', true);
      const customerId = await seedBillable('3000000030', 30);
      // Due 30 Sep: grace ran 1–3 Oct.
      await seedBill(
        customerId,
        'OVERDUE',
        new Date('2026-10-01T04:59:59.999Z')
      );

      const result = await useCase.execute({ now: NOW });

      expect(result.value.cut).toBe(1);
      expect(await serviceStatus(customerId)).toBe('SUSPENDED');
    });

    it('cuts a bill that only went overdue in the same run', async () => {
      await enableBilling('ADVANCE', true);
      const customerId = await seedBillable('3000000030', 30);
      await seedBill(
        customerId,
        'PENDING',
        new Date('2026-10-01T04:59:59.999Z')
      );

      await useCase.execute({ now: NOW });

      expect(await serviceStatus(customerId)).toBe('SUSPENDED');
    });

    it('leaves a customer alone during the grace days', async () => {
      await enableBilling('ADVANCE', true);
      const customerId = await seedBillable('3000000030', 30);
      // Due 10 Oct: the last grace day is 13 Oct.
      await seedBill(
        customerId,
        'OVERDUE',
        new Date('2026-10-11T04:59:59.999Z')
      );

      const result = await useCase.execute({ now: NOW });

      expect(result.value.cut).toBe(0);
      expect(await serviceStatus(customerId)).toBe('ACTIVE');
    });

    it('cuts nobody while the cut is off', async () => {
      await enableBilling('ADVANCE', false);
      const customerId = await seedBillable('3000000030', 30);
      await seedBill(
        customerId,
        'OVERDUE',
        new Date('2026-10-01T04:59:59.999Z')
      );

      await useCase.execute({ now: NOW });

      expect(await serviceStatus(customerId)).toBe('ACTIVE');
    });
  });

  describe('[BIL-320] [BIL-321] [BIL-324] notices', () => {
    it('emails each issued bill with its PDF to customers who have an email', async () => {
      await enableBilling();
      await seedBillable(
        '3000000015',
        15,
        LONG_AGO,
        'ana@example.com'
      );
      await seedBillable('3000000016', 15);

      const result = await useCase.execute({ now: NOW });

      expect(result.value.generated).toBe(2);
      expect(result.value.emailed).toBe(1);
      expect(email.sent).toHaveLength(1);
      expect(email.sent[0].to).toBe('ana@example.com');
      expect(email.sent[0].attachments![0].contentType).toBe(
        'application/pdf'
      );
      expect(
        email.sent[0]
          .attachments![0].content.subarray(0, 4)
          .toString()
      ).toBe('%PDF');
    });

    it('[BIL-324] sends each issued bill by WhatsApp with its PDF when there is a bill template', async () => {
      await enableBilling('ADVANCE', false, 'cuenta_cobro');
      await seedBillable('3000000015', 15);

      const result = await useCase.execute({ now: NOW });

      expect(result.value.whatsAppSent).toBe(1);
      expect(whatsApp.sent).toHaveLength(1);
      expect(whatsApp.sent[0].templateName).toBe('cuenta_cobro');
      expect(
        whatsApp.sent[0].document!.content.subarray(0, 4).toString()
      ).toBe('%PDF');
    });

    it('[BIL-324] sends no bill by WhatsApp without a bill template', async () => {
      await enableBilling();
      await seedBillable('3000000015', 15);

      const result = await useCase.execute({ now: NOW });

      expect(result.value.whatsAppSent).toBe(0);
      expect(whatsApp.sent).toHaveLength(0);
    });

    it('reminds an overdue customer on a late grace day, once that day', async () => {
      await enableBilling('ADVANCE', true);
      const customerId = await seedBillable(
        '3000000015',
        15,
        LONG_AGO,
        'ana@example.com'
      );
      // Due 10 Oct: 12 Oct is the second of three grace days.
      await seedBill(
        customerId,
        'OVERDUE',
        new Date('2026-10-11T04:59:59.999Z')
      );

      const first = await useCase.execute({ now: NOW });
      const again = await useCase.execute({
        now: new Date('2026-10-12T15:00:00.000Z')
      });

      expect(first.value.reminded).toBe(1);
      expect(again.value.reminded).toBe(0);
      const reminders = email.sent.filter((m) =>
        m.subject.startsWith('Recordatorio')
      );
      expect(reminders).toHaveLength(1);
      expect(reminders[0].text).toContain('14 de octubre de 2026');
      expect(await prisma.billReminder.count()).toBe(1);
    });
  });
});
