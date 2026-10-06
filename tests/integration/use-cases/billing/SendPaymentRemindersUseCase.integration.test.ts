// Source: src/application/billing/use-cases/SendPaymentRemindersUseCase.ts
// No HTTP surface: the daily billing run calls it.

import { PrismaClient } from 'generated/prisma/client';
import { SendPaymentRemindersUseCase } from 'application/billing/use-cases';
import { BillingMode, BillingSettings } from 'domain/billing';
import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';
import {
  CustomerTemplateMessage,
  ICustomerNotificationService
} from 'application/notifications/interfaces';
import {
  PrismaBillRepository,
  PrismaBillReminderLog
} from 'infrastructure/billing/repositories';
import { PrismaBillingContactsQuery } from 'infrastructure/billing/queries';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeEmailSender } from '../../helpers/FakeEmailSender';
import {
  cleanCustomers,
  createTestPrisma,
  seedActiveContractedService,
  seedCustomer,
  seedServicePlan
} from '../../helpers/db';

// 06:00 on 17 Oct in Bogotá: a late grace day for a bill due on the 15th.
const NOW = new Date('2026-10-17T11:00:00.000Z');
const DUE_15_OCT = new Date('2026-10-16T04:59:59.999Z');

const SETTINGS = BillingSettings.reconstitute({
  automaticBillingEnabled: true,
  billingMode: BillingMode.ADVANCE,
  issueLeadDays: 5,
  graceDays: 3,
  automaticCutEnabled: true,
  reminderWhatsAppTemplate: 'recordatorio_pago'
});

// Records WhatsApp sends instead of calling Meta.
class RecordingWhatsApp implements ICustomerNotificationService {
  sent: { to: string; templateName?: string }[] = [];

  async sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>> {
    this.sent.push({
      to: to.value,
      templateName: message.templateName
    });
    return Result.ok();
  }
}

describe('SendPaymentRemindersUseCase — integration', () => {
  let prisma: PrismaClient;
  let email: FakeEmailSender;
  let whatsApp: RecordingWhatsApp;
  let useCase: SendPaymentRemindersUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    email = new FakeEmailSender();
    whatsApp = new RecordingWhatsApp();
    useCase = new SendPaymentRemindersUseCase(
      new PrismaBillRepository(prisma),
      new PrismaBillReminderLog(prisma),
      new PrismaBillingContactsQuery(prisma),
      email,
      whatsApp,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanCustomers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    email.sent = [];
    whatsApp.sent = [];
  });

  async function seedBill(
    status: 'OVERDUE' | 'PAID' | 'PENDING',
    dueDate: Date,
    phone = '3000000001'
  ): Promise<string> {
    const planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
    const customerId = await seedCustomer(prisma, {
      phone,
      fullName: 'Ana Gómez',
      email: `${phone}@example.com`
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
        periodMonth: 10,
        status,
        issueDate: new Date('2026-10-10T11:00:00.000Z'),
        dueDate,
        paidAt:
          status === 'PAID' ? new Date('2026-10-16T15:00:00Z') : null,
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
    return bill.id;
  }

  it('[BIL-321] reminds an overdue customer by email and WhatsApp, and logs the day', async () => {
    const billId = await seedBill('OVERDUE', DUE_15_OCT);

    const result = await useCase.execute({
      now: NOW,
      settings: SETTINGS
    });

    expect(result.value).toEqual({ reminded: 1, failed: [] });
    expect(email.sent).toHaveLength(1);
    expect(whatsApp.sent).toHaveLength(1);
    expect(whatsApp.sent[0].to).toContain('3000000001');
    expect(whatsApp.sent[0].templateName).toBe('recordatorio_pago');
    const logged = await prisma.billReminder.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0].billId).toBe(billId);
    expect(logged[0].sentOn.toISOString()).toBe(
      '2026-10-17T00:00:00.000Z'
    );
  });

  it('[BIL-323] a second run the same day sends nothing', async () => {
    await seedBill('OVERDUE', DUE_15_OCT);

    await useCase.execute({ now: NOW, settings: SETTINGS });
    const again = await useCase.execute({
      now: new Date('2026-10-17T20:00:00.000Z'),
      settings: SETTINGS
    });

    expect(again.value.reminded).toBe(0);
    expect(email.sent).toHaveLength(1);
  });

  it('[BIL-321] reminds again on the next grace day', async () => {
    await seedBill('OVERDUE', DUE_15_OCT);

    await useCase.execute({ now: NOW, settings: SETTINGS });
    const next = await useCase.execute({
      now: new Date('2026-10-18T11:00:00.000Z'),
      settings: SETTINGS
    });

    expect(next.value.reminded).toBe(1);
    expect(await prisma.billReminder.count()).toBe(2);
  });

  it('[BIL-321] leaves paid bills and bills outside the last two grace days alone', async () => {
    await seedBill('PAID', DUE_15_OCT, '3000000002');
    // Due the 16th: 17 Oct is its first grace day.
    await seedBill(
      'OVERDUE',
      new Date('2026-10-17T04:59:59.999Z'),
      '3000000003'
    );

    const result = await useCase.execute({
      now: NOW,
      settings: SETTINGS
    });

    expect(result.value.reminded).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it('[BIL-323] deleting a bill deletes its reminder log', async () => {
    const billId = await seedBill('OVERDUE', DUE_15_OCT);
    await useCase.execute({ now: NOW, settings: SETTINGS });

    await prisma.bill.delete({ where: { id: billId } });

    expect(await prisma.billReminder.count()).toBe(0);
  });
});
