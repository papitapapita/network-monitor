// Source: src/application/billing/use-cases/SendPaymentRemindersUseCase.ts

import { SendPaymentRemindersUseCase } from '../../../../src/application/billing/use-cases/SendPaymentRemindersUseCase';
import { IBillingContactsQuery } from '../../../../src/application/billing/interfaces';
import { ICustomerNotificationService } from '../../../../src/application/notifications/interfaces';
import {
  IBillRepository,
  IBillReminderLog
} from '../../../../src/domain/billing/repository';
import {
  Bill,
  BillLineItem,
  BillStatus,
  BillingMode,
  BillingPeriod,
  BillingSettings
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

// 06:00 on 17 Oct in Bogotá: the second of three grace days of a bill due
// on the 15th.
const NOW = new Date('2026-10-17T11:00:00.000Z');

function settings(
  overrides: Partial<{
    automaticCutEnabled: boolean;
    graceDays: number;
    reminderWhatsAppTemplate: string | null;
  }> = {}
): BillingSettings {
  return BillingSettings.reconstitute({
    automaticBillingEnabled: true,
    billingMode: BillingMode.ADVANCE,
    issueLeadDays: 5,
    graceDays: overrides.graceDays ?? 3,
    automaticCutEnabled: overrides.automaticCutEnabled ?? true,
    reminderWhatsAppTemplate:
      overrides.reminderWhatsAppTemplate === undefined
        ? 'recordatorio_pago'
        : overrides.reminderWhatsAppTemplate,
    billWhatsAppTemplate: null
  });
}

function overdueBill(): Bill {
  return Bill.reconstitute(BillId.create(), {
    customerId: CustomerId.create(),
    period: BillingPeriod.create(2026, 10).value,
    status: BillStatus.OVERDUE,
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

describe('SendPaymentRemindersUseCase', () => {
  let bill: Bill;
  let billRepo: { findOverdueDueBetween: jest.Mock };
  let log: jest.Mocked<IBillReminderLog>;
  let contacts: jest.Mocked<IBillingContactsQuery>;
  let email: { send: jest.Mock };
  let whatsApp: jest.Mocked<ICustomerNotificationService>;

  const build = (
    wa: ICustomerNotificationService | null = whatsApp
  ) =>
    new SendPaymentRemindersUseCase(
      billRepo as unknown as IBillRepository,
      log,
      contacts,
      email,
      wa,
      makeLogger()
    );

  beforeEach(() => {
    bill = overdueBill();
    billRepo = {
      findOverdueDueBetween: jest
        .fn()
        .mockResolvedValue(Result.ok([bill]))
    };
    log = {
      wasSentOn: jest.fn().mockResolvedValue(Result.ok(false)),
      record: jest.fn().mockResolvedValue(Result.ok())
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
    email = { send: jest.fn().mockResolvedValue(Result.ok()) };
    whatsApp = {
      sendTemplate: jest.fn().mockResolvedValue(Result.ok())
    };
  });

  it('[BIL-321] reminds by email and WhatsApp, and records the day', async () => {
    const result = await build().execute({
      now: NOW,
      settings: settings()
    });

    expect(result.value).toEqual({ reminded: 1, failed: [] });
    expect(billRepo.findOverdueDueBetween).toHaveBeenCalledWith(
      new Date('2026-10-14T05:00:00.000Z'),
      new Date('2026-10-16T04:59:59.999Z')
    );
    expect(email.send.mock.calls[0][0].text).toContain(
      '19 de octubre de 2026'
    );
    expect(whatsApp.sendTemplate.mock.calls[0][1]).toEqual({
      templateName: 'recordatorio_pago',
      bodyParams: [
        'Ana Gómez',
        '2026-10',
        '$80.000',
        '19 de octubre de 2026'
      ]
    });
    expect(log.record).toHaveBeenCalledWith(
      bill.id,
      new Date('2026-10-17T00:00:00.000Z')
    );
  });

  it('[BIL-323] sends nothing twice on the same day', async () => {
    log.wasSentOn.mockResolvedValue(Result.ok(true));

    const result = await build().execute({
      now: NOW,
      settings: settings()
    });

    expect(result.value.reminded).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
    expect(whatsApp.sendTemplate).not.toHaveBeenCalled();
  });

  it('[BIL-322] reminds by email only without a template', async () => {
    await build().execute({
      now: NOW,
      settings: settings({ reminderWhatsAppTemplate: null })
    });

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(whatsApp.sendTemplate).not.toHaveBeenCalled();
  });

  it('[BIL-322] reminds by email only where WhatsApp is not set up', async () => {
    const result = await build(null).execute({
      now: NOW,
      settings: settings()
    });

    expect(result.value.reminded).toBe(1);
  });

  it('counts a bill reminded when one channel delivered, and records the other failure', async () => {
    whatsApp.sendTemplate.mockResolvedValue(
      Result.fail('WhatsApp API error: template not approved')
    );

    const result = await build().execute({
      now: NOW,
      settings: settings()
    });

    expect(result.value.reminded).toBe(1);
    expect(result.value.failed).toEqual([
      {
        id: bill.id.toString(),
        error: 'WhatsApp: WhatsApp API error: template not approved'
      }
    ]);
    expect(log.record).toHaveBeenCalled();
  });

  it('does not record a bill nobody could be reached about', async () => {
    contacts.findContact.mockResolvedValue(
      Result.ok({ fullName: 'Ana', phone: '3001234567', email: null })
    );

    const result = await build(null).execute({
      now: NOW,
      settings: settings()
    });

    expect(result.value.reminded).toBe(0);
    expect(log.record).not.toHaveBeenCalled();
  });

  it('[BIL-321] sends nothing while the automatic cut is off', async () => {
    const result = await build().execute({
      now: NOW,
      settings: settings({ automaticCutEnabled: false })
    });

    expect(result.value.reminded).toBe(0);
    expect(billRepo.findOverdueDueBetween).not.toHaveBeenCalled();
  });

  it('[BIL-321] sends nothing with no grace days', async () => {
    await build().execute({
      now: NOW,
      settings: settings({ graceDays: 0 })
    });

    expect(billRepo.findOverdueDueBetween).not.toHaveBeenCalled();
  });
});
