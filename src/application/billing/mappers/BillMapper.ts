import {
  Bill,
  BillLineItem,
  BillPayment,
  isoDay
} from 'domain/billing';
import {
  BillLineItemDTO,
  BillPaymentDTO,
  BillResponseDTO,
  BillListResponseDTO
} from '../dtos';

export class BillMapper {
  public static toDTO(bill: Bill): BillResponseDTO {
    return {
      id: bill.id.toString(),
      customerId: bill.customerId.toString(),
      period: bill.period.toString(),
      status: bill.status,
      issueDate: bill.issueDate.toISOString(),
      dueDate: bill.dueDate.toISOString(),
      paidAt: bill.paidAt !== null ? bill.paidAt.toISOString() : null,
      payment:
        bill.payment !== null
          ? this.toPaymentDTO(bill.payment)
          : null,
      total: bill.total.toNumber(),
      lineItems: bill.lineItems.map((item) =>
        this.toLineItemDTO(item)
      ),
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    bills: Bill[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): BillListResponseDTO {
    return {
      bills: bills.map((b) => this.toDTO(b)),
      total,
      hasMore: offset + bills.length < total,
      limit,
      offset
    };
  }

  private static toPaymentDTO(payment: BillPayment): BillPaymentDTO {
    return {
      method: payment.method,
      reference: payment.reference,
      amount: payment.amount.toNumber(),
      paidAt: payment.paidAt.toISOString(),
      recordedByUserId: payment.recordedBy?.toString() ?? null
    };
  }

  private static toLineItemDTO(item: BillLineItem): BillLineItemDTO {
    return {
      contractedServiceId: item.contractedServiceId.toString(),
      servicePlanId: item.servicePlanId.toString(),
      planName: item.planName,
      monthlyPrice: item.monthlyPrice.toNumber(),
      amount: item.amount.toNumber(),
      serviceFrom: item.servicePeriod
        ? isoDay(item.servicePeriod.from)
        : null,
      serviceTo: item.servicePeriod
        ? isoDay(item.servicePeriod.to)
        : null
    };
  }
}
