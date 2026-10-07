// Source: src/application/billing/use-cases/SendBillWhatsAppUseCase.ts
// No HTTP surface: the daily billing run calls it for each bill it issues.

import { PrismaClient } from 'generated/prisma/client';
import {
  GetBillPdfUseCase,
  SendBillWhatsAppUseCase
} from 'application/billing/use-cases';
import { PrismaBillRepository } from 'infrastructure/billing/repositories';
import { PrismaBillingContactsQuery } from 'infrastructure/billing/queries';
import { PdfKitBillPdfRenderer } from 'infrastructure/billing/services';
import { PrismaCustomerRepository } from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeCustomerWhatsApp } from '../../helpers/FakeCustomerWhatsApp';
import {
  cleanCustomers,
  createTestPrisma,
  seedActiveContractedService,
  seedCustomer,
  seedServicePlan
} from '../../helpers/db';

const GHOST_ID = '00000000-0000-4000-8000-000000000000';

describe('SendBillWhatsAppUseCase — integration', () => {
  let prisma: PrismaClient;
  let whatsApp: FakeCustomerWhatsApp;
  let useCase: SendBillWhatsAppUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    const logger = new WinstonLogger();
    const bills = new PrismaBillRepository(prisma);
    whatsApp = new FakeCustomerWhatsApp();
    useCase = new SendBillWhatsAppUseCase(
      bills,
      new PrismaBillingContactsQuery(prisma),
      new GetBillPdfUseCase(
        bills,
        new PrismaCustomerRepository(prisma),
        new PdfKitBillPdfRenderer(),
        logger
      ),
      whatsApp,
      logger
    );
  });

  afterAll(async () => {
    await cleanCustomers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    whatsApp.sent = [];
    whatsApp.failWith = null;
  });

  async function seedBill(phone = '3000000001'): Promise<string> {
    const planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
    const customerId = await seedCustomer(prisma, {
      phone,
      fullName: 'Ana Gómez'
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
        status: 'PENDING',
        issueDate: new Date('2026-10-10T11:00:00.000Z'),
        dueDate: new Date('2026-10-16T04:59:59.999Z'),
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

  it('[BIL-324] sends the bill template to the customer with the PDF', async () => {
    const billId = await seedBill();

    const result = await useCase.execute({
      billId,
      templateName: 'cuenta_cobro'
    });

    expect(result.value).toEqual({ sent: true });
    expect(whatsApp.sent).toHaveLength(1);
    const sent = whatsApp.sent[0];
    expect(sent.to).toContain('3000000001');
    expect(sent.templateName).toBe('cuenta_cobro');
    expect(sent.bodyParams.slice(0, 3)).toEqual([
      'Ana Gómez',
      '2026-10',
      '$80.000'
    ]);
    expect(sent.document!.filename).toBe(
      `bill-2026-10-${billId}.pdf`
    );
    expect(sent.document!.content.subarray(0, 4).toString()).toBe(
      '%PDF'
    );
  });

  it('passes on a send failure', async () => {
    const billId = await seedBill();
    whatsApp.failWith = 'WhatsApp API error: 131058';

    const result = await useCase.execute({
      billId,
      templateName: 'cuenta_cobro'
    });

    expect(result.error).toBe('WhatsApp: WhatsApp API error: 131058');
  });

  it('fails for an unknown bill', async () => {
    const result = await useCase.execute({
      billId: GHOST_ID,
      templateName: 'cuenta_cobro'
    });

    expect(result.error).toBe(`Bill not found: ${GHOST_ID}`);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      billId: 'nope',
      templateName: 'cuenta_cobro'
    });

    expect(result.error).toContain('Invalid bill ID');
  });
});
