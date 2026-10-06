// Source: src/application/billing/use-cases/SendBillEmailUseCase.ts

import { SendBillEmailUseCase } from '../../../../src/application/billing/use-cases/SendBillEmailUseCase';
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

describe('SendBillEmailUseCase', () => {
  let billRepo: { findById: jest.Mock };
  let contacts: jest.Mocked<IBillingContactsQuery>;
  let getPdf: { execute: jest.Mock };
  let email: { send: jest.Mock };
  let useCase: SendBillEmailUseCase;

  beforeEach(() => {
    billRepo = {
      findById: jest.fn().mockResolvedValue(Result.ok(makeBill()))
    };
    contacts = {
      findContact: jest.fn().mockResolvedValue(
        Result.ok({
          fullName: 'Ana Gómez',
          phone: '3001234567',
          email: 'ana@example.com'
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
    email = { send: jest.fn().mockResolvedValue(Result.ok()) };
    useCase = new SendBillEmailUseCase(
      billRepo as unknown as IBillRepository,
      contacts,
      getPdf as unknown as GetBillPdfUseCase,
      email,
      makeLogger()
    );
  });

  it('[BIL-320] emails the bill with its PDF attached', async () => {
    const result = await useCase.execute({
      billId: BILL_ID.toString()
    });

    expect(result.value).toEqual({ sent: true });
    const message = email.send.mock.calls[0][0];
    expect(message.to).toBe('ana@example.com');
    expect(message.subject).toBe('Su cuenta del periodo 2026-10');
    expect(message.attachments).toEqual([
      {
        filename: 'bill-2026-10.pdf',
        content: PDF,
        contentType: 'application/pdf'
      }
    ]);
  });

  it('[BIL-320] skips a customer with no email address', async () => {
    contacts.findContact.mockResolvedValue(
      Result.ok({ fullName: 'Ana', phone: '3001234567', email: null })
    );

    const result = await useCase.execute({
      billId: BILL_ID.toString()
    });

    expect(result.value).toEqual({ sent: false });
    expect(getPdf.execute).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('passes on why the email could not be sent', async () => {
    email.send.mockResolvedValue(Result.fail('Email not sent: 550'));

    const result = await useCase.execute({
      billId: BILL_ID.toString()
    });

    expect(result.error).toBe('Email not sent: 550');
  });

  it('fails for an unknown bill', async () => {
    billRepo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      billId: BILL_ID.toString()
    });

    expect(result.error).toContain('Bill not found');
  });
});
