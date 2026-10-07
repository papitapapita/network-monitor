import { Result } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { PhoneNumber } from 'domain/customers/value-objects';
import { IBillRepository } from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ICustomerNotificationService } from 'application/notifications/interfaces';
import { IBillingContactsQuery } from '../interfaces';
import { billTemplateParams } from '../services';
import { GetBillPdfUseCase } from './GetBillPdfUseCase';

export interface SendBillWhatsAppRequestDTO {
  billId: string;
  templateName: string;
}

export interface SendBillWhatsAppResultDTO {
  // False when WhatsApp is not set up on this install.
  sent: boolean;
}

// BIL-324: when the ISP has a bill template, a bill the daily run issues is
// also sent by WhatsApp with its PDF.
export class SendBillWhatsAppUseCase extends UseCase<
  SendBillWhatsAppRequestDTO,
  SendBillWhatsAppResultDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly contacts: IBillingContactsQuery,
    private readonly getBillPdf: GetBillPdfUseCase,
    // Null while WhatsApp is not set up on this install.
    private readonly whatsApp: ICustomerNotificationService | null,
    logger: ILogger
  ) {
    super(logger, 'SendBillWhatsAppUseCase');
  }

  protected async executeImpl(
    request: SendBillWhatsAppRequestDTO
  ): Promise<Result<SendBillWhatsAppResultDTO>> {
    if (this.whatsApp === null) return this.ok({ sent: false });

    const billId = BillId.parse(request.billId);
    if (billId.isFailure) {
      return this.fail(`Invalid bill ID: ${billId.error}`);
    }
    const found = await this.billRepository.findById(billId.value);
    if (found.isFailure) return this.fail(found.error!);
    if (found.value === null) {
      return this.fail(`Bill not found: ${request.billId}`);
    }
    const bill = found.value;

    const contact = await this.contacts.findContact(
      bill.customerId.toString()
    );
    if (contact.isFailure) return this.fail(contact.error!);
    if (contact.value === null) {
      return this.fail(`Customer not found: ${bill.customerId}`);
    }
    const phone = PhoneNumber.create(contact.value.phone);
    if (phone.isFailure) {
      return this.fail(`WhatsApp: ${phone.error}`);
    }

    const pdf = await this.getBillPdf.execute({ id: request.billId });
    if (pdf.isFailure) return this.fail(pdf.error!);

    const sent = await this.whatsApp.sendTemplate(phone.value, {
      templateName: request.templateName,
      bodyParams: billTemplateParams({
        fullName: contact.value.fullName,
        period: bill.period.toString(),
        total: bill.total,
        dueDate: bill.dueDate
      }),
      document: {
        filename: pdf.value.fileName,
        content: pdf.value.content
      }
    });
    if (sent.isFailure) return this.fail(`WhatsApp: ${sent.error}`);

    return this.ok({ sent: true });
  }
}
