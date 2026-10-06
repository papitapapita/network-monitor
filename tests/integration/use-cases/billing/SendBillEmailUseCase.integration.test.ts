// Source: src/application/billing/use-cases/SendBillEmailUseCase.ts
// No HTTP surface: the daily billing run calls it for each bill it issues.

import { PrismaClient } from 'generated/prisma/client';
import {
  GetBillPdfUseCase,
  SendBillEmailUseCase
} from 'application/billing/use-cases';
import { PrismaBillRepository } from 'infrastructure/billing/repositories';
import { PrismaBillingContactsQuery } from 'infrastructure/billing/queries';
import { PdfKitBillPdfRenderer } from 'infrastructure/billing/services';
import { PrismaCustomerRepository } from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeEmailSender } from '../../helpers/FakeEmailSender';
import {
  cleanCustomers,
  createTestPrisma,
  seedActiveContractedService,
  seedCustomer,
  seedServicePlan
} from '../../helpers/db';

const GHOST_ID = '00000000-0000-4000-8000-000000000000';

describe('SendBillEmailUseCase — integration', () => {
  let prisma: PrismaClient;
  let email: FakeEmailSender;
  let useCase: SendBillEmailUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    const logger = new WinstonLogger();
    const bills = new PrismaBillRepository(prisma);
    email = new FakeEmailSender();
    useCase = new SendBillEmailUseCase(
      bills,
      new PrismaBillingContactsQuery(prisma),
      new GetBillPdfUseCase(
        bills,
        new PrismaCustomerRepository(prisma),
        new PdfKitBillPdfRenderer(),
        logger
      ),
      email,
      logger
    );
  });

  afterAll(async () => {
    await cleanCustomers(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
    email.sent = [];
    email.failWith = null;
  });

  async function seedBill(
    emailAddress: string | null
  ): Promise<string> {
    const planId = await seedServicePlan(prisma, {
      name: 'Plan 50',
      monthlyPrice: 80000
    });
    const customerId = await seedCustomer(prisma, {
      phone: '3000000001',
      fullName: 'Ana Gómez',
      email: emailAddress
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

  it('[BIL-320] emails the bill as a PDF to the customer', async () => {
    const billId = await seedBill('ana@example.com');

    const result = await useCase.execute({ billId });

    expect(result.value).toEqual({ sent: true });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      to: 'ana@example.com',
      subject: 'Su cuenta del periodo 2026-10'
    });
    expect(email.sent[0].text).toContain('$80.000');
    const pdf = email.sent[0].attachments![0];
    expect(pdf.filename).toBe(`bill-2026-10-${billId}.pdf`);
    expect(pdf.content.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('[BIL-320] skips a customer with no email', async () => {
    const billId = await seedBill(null);

    const result = await useCase.execute({ billId });

    expect(result.value).toEqual({ sent: false });
    expect(email.sent).toHaveLength(0);
  });

  it('passes on a send failure', async () => {
    const billId = await seedBill('ana@example.com');
    email.failWith = 'Email not sent: 550';

    const result = await useCase.execute({ billId });

    expect(result.error).toBe('Email not sent: 550');
  });

  it('fails for an unknown bill', async () => {
    const result = await useCase.execute({ billId: GHOST_ID });

    expect(result.error).toBe(`Bill not found: ${GHOST_ID}`);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({ billId: 'nope' });

    expect(result.error).toContain('Invalid bill ID');
  });
});
