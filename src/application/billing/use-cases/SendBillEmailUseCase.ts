import { Result } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { IBillRepository } from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import { IBillingContactsQuery } from '../interfaces';
import { billEmail } from '../services';
import { GetBillPdfUseCase } from './GetBillPdfUseCase';

export interface SendBillEmailRequestDTO {
  billId: string;
}

export interface SendBillEmailResultDTO {
  // False when the customer has no email address.
  sent: boolean;
}

// BIL-320: a bill the daily run issues is emailed to the customer with its
// PDF attached. A customer with no email address is skipped.
export class SendBillEmailUseCase extends UseCase<
  SendBillEmailRequestDTO,
  SendBillEmailResultDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly contacts: IBillingContactsQuery,
    private readonly getBillPdf: GetBillPdfUseCase,
    private readonly emailSender: IEmailSender,
    logger: ILogger
  ) {
    super(logger, 'SendBillEmailUseCase');
  }

  protected async executeImpl(
    request: SendBillEmailRequestDTO
  ): Promise<Result<SendBillEmailResultDTO>> {
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
    if (contact.value === null || contact.value.email === null) {
      return this.ok({ sent: false });
    }

    const pdf = await this.getBillPdf.execute({ id: request.billId });
    if (pdf.isFailure) return this.fail(pdf.error!);

    const sent = await this.emailSender.send({
      to: contact.value.email,
      ...billEmail({
        fullName: contact.value.fullName,
        period: bill.period.toString(),
        total: bill.total,
        dueDate: bill.dueDate
      }),
      attachments: [
        {
          filename: pdf.value.fileName,
          content: pdf.value.content,
          contentType: 'application/pdf'
        }
      ]
    });
    if (sent.isFailure) return this.fail(sent.error!);

    return this.ok({ sent: true });
  }
}
