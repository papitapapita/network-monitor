// Source: src/application/billing/use-cases/SendBillWhatsAppUseCase.ts

import { SendBillWhatsAppUseCase } from '../../../../src/application/billing/use-cases/SendBillWhatsAppUseCase';
import { GetBillPdfUseCase } from '../../../../src/application/billing/use-cases/GetBillPdfUseCase';
import { IBillingContactsQuery } from '../../../../src/application/billing/interfaces';
import { IBillRepository } from '../../../../src/domain/billing/repository';
import {
  Bill,
  BillLineItem,
  BillStatus,
  BillingPeriod
} from '../../../../src/domain/billing';
import {
  BillId,
  ContractedServiceId,
  CustomerId,
  ServicePlanId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

const BILL_ID = BillId.create();
const PDF = Buffer.from('%PDF-1.4');

function makeBill(): Bill {
  return Bill.reconstitute(BILL_ID, {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2026, 10).value,
    status: BillStatus.PENDING,
    lineItems: [
      BillLineItem.create({
        contractedServiceId: ContractedServiceId.create(),
        servicePlanId: ServicePlanId.create(),
        planName: 'Plan 50',
        monthlyPrice: Money.create(80000).value
      }).value
    ],
    issueDate: new Date('2026-10-10T11:00:00Z'),
    dueDate: new Date('2026-10-16T04:59:59.999Z'),
    paidAt: null,
    createdAt: new Date('2026-10-10T11:00:00Z'),
    updatedAt: new Date('2026-10-10T11:00:00Z')
  });
}

describe('SendBillWhatsAppUseCase', () => {
  let billRepo: { findById: jest.Mock };
  let contacts: jest.Mocked<IBillingContactsQuery>;
  let getPdf: { execute: jest.Mock };
  let whatsApp: { sendTemplate: jest.Mock };
  let useCase: SendBillWhatsAppUseCase;

  const build = (
    service: { sendTemplate: jest.Mock } | null = whatsApp
  ): SendBillWhatsAppUseCase =>
    new SendBillWhatsAppUseCase(
      billRepo as unknown as IBillRepository,
      contacts,
      getPdf as unknown as GetBillPdfUseCase,
      service,
      makeLogger()
    );

  beforeEach(() => {
    billRepo = {
      findById: jest.fn().mockResolvedValue(Result.ok(makeBill()))
    };
    contacts = {
      findContact: jest.fn().mockResolvedValue(
        Result.ok({
          fullName: 'Ana Gómez',
          phone: '3001234567',
          email: null
        })
      )
    };
    getPdf = {
      execute: jest
        .fn()
        .mockResolvedValue(
          Result.ok({ fileName: 'bill-2026-10.pdf', content: PDF })
        )
    };
    whatsApp = {
      sendTemplate: jest.fn().mockResolvedValue(Result.ok())
    };
    useCase = build();
  });

  const request = {
    billId: BILL_ID.toString(),
    templateName: 'cuenta_cobro'
  };

  it('[BIL-324] sends the bill template with the PDF as its document', async () => {
    const result = await useCase.execute(request);

    expect(result.value).toEqual({ sent: true });
    const [to, message] = whatsApp.sendTemplate.mock.calls[0];
    expect(to.value).toContain('3001234567');
    expect(message.templateName).toBe('cuenta_cobro');
    expect(message.bodyParams[0]).toBe('Ana Gómez');
    expect(message.bodyParams[1]).toBe('2026-10');
    expect(message.bodyParams[2]).toBe('$80.000');
    expect(message.bodyParams).toHaveLength(4);
    expect(message.document).toEqual({
      filename: 'bill-2026-10.pdf',
      content: PDF
    });
  });

  it('[BIL-324] sends nothing while WhatsApp is not set up', async () => {
    const result = await build(null).execute(request);

    expect(result.value).toEqual({ sent: false });
    expect(billRepo.findById).not.toHaveBeenCalled();
  });

  it('fails when the phone is not a valid number', async () => {
    contacts.findContact.mockResolvedValue(
      Result.ok({ fullName: 'Ana Gómez', phone: 'abc', email: null })
    );

    const result = await useCase.execute(request);

    expect(result.error).toContain('WhatsApp: ');
    expect(whatsApp.sendTemplate).not.toHaveBeenCalled();
  });

  it('passes on why WhatsApp did not send', async () => {
    whatsApp.sendTemplate.mockResolvedValue(
      Result.fail('WhatsApp API error: template not approved')
    );

    const result = await useCase.execute(request);

    expect(result.error).toBe(
      'WhatsApp: WhatsApp API error: template not approved'
    );
  });

  it('fails for an unknown bill', async () => {
    billRepo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute(request);

    expect(result.error).toBe(`Bill not found: ${BILL_ID}`);
  });
});
