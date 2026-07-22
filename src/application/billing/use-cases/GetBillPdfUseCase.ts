import { BillId } from 'domain/shared/ids';
import { IBillRepository } from 'domain/billing/repository';
import { ICustomerRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IBillPdfRenderer } from '../interfaces';
import { GetBillPdfRequestDTO, BillPdfResponseDTO } from '../dtos';

export class GetBillPdfUseCase extends UseCase<
  GetBillPdfRequestDTO,
  BillPdfResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly pdfRenderer: IBillPdfRenderer,
    logger: ILogger
  ) {
    super(logger, 'GetBillPdfUseCase');
  }

  protected async beforeExecute(
    request: GetBillPdfRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bill ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetBillPdfRequestDTO
  ): Promise<Result<BillPdfResponseDTO>> {
    const idResult = BillId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid bill ID: ${idResult.error}`);
    }

    const findResult = await this.billRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Bill not found: ${request.id}`);
    }
    const bill = findResult.value;

    const customerResult = await this.customerRepository.findById(
      bill.customerId
    );
    if (customerResult.isFailure) {
      return this.fail(customerResult.error!);
    }
    if (customerResult.value === null) {
      return this.fail(
        `Customer not found for bill: ${bill.customerId.toString()}`
      );
    }
    const customer = customerResult.value;

    const renderResult = await this.pdfRenderer.render({
      billId: bill.id.toString(),
      period: bill.period.toString(),
      status: bill.status,
      issueDate: bill.issueDate,
      dueDate: bill.dueDate,
      paidAt: bill.paidAt,
      total: bill.total.toNumber(),
      lineItems: bill.lineItems.map((item) => ({
        planName: item.planName,
        monthlyPrice: item.monthlyPrice.toNumber()
      })),
      customer: {
        fullName: customer.fullName,
        phone: customer.phone.toString(),
        email:
          customer.email !== null ? customer.email.toString() : null,
        cedula:
          customer.cedula !== null ? customer.cedula.toString() : null
      }
    });
    if (renderResult.isFailure) {
      return this.fail(renderResult.error!);
    }

    return this.ok({
      fileName: `bill-${bill.period.toString()}-${bill.id.toString()}.pdf`,
      content: renderResult.value
    });
  }
}
