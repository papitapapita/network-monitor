import { Result } from 'domain/shared/core';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId,
  UserId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Bill } from 'domain/billing/aggregates';
import { BillStatus, PaymentMethod } from 'domain/billing/enums';
import {
  BillingPeriod,
  BillLineItem,
  BillPayment,
  ServicePeriod
} from 'domain/billing/value-objects';
import {
  BillStatus as PrismaBillStatus,
  PaymentMethod as PrismaPaymentMethod
} from 'generated/prisma/client';

interface BillLineItemRecord {
  id: string;
  billId: string;
  contractedServiceId: string;
  servicePlanId: string;
  planName: string;
  monthlyPrice: number | { toNumber(): number };
  amount: number | { toNumber(): number };
  serviceFrom: Date | null;
  serviceTo: Date | null;
}

interface BillPaymentRecord {
  method: string;
  reference: string | null;
  amount: number | { toNumber(): number };
  paidAt: Date;
  recordedByUserId: string | null;
}

interface BillRecord {
  id: string;
  customerId: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: BillLineItemRecord[];
  payment?: BillPaymentRecord | null;
}

export class BillPrismaMapper {
  public static toDomain(raw: BillRecord): Result<Bill> {
    const idResult = BillId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Bill>(`Invalid bill id: ${idResult.error}`);
    }

    const customerIdResult = CustomerId.parse(raw.customerId);
    if (customerIdResult.isFailure) {
      return Result.fail<Bill>(
        `Invalid customer id: ${customerIdResult.error}`
      );
    }

    const periodResult = BillingPeriod.create(
      raw.periodYear,
      raw.periodMonth
    );
    if (periodResult.isFailure) {
      return Result.fail<Bill>(
        `Invalid billing period: ${periodResult.error}`
      );
    }

    const lineItems: BillLineItem[] = [];
    for (const rawItem of raw.lineItems) {
      const lineItemResult = this.lineItemToDomain(rawItem);
      if (lineItemResult.isFailure) {
        return Result.fail<Bill>(lineItemResult.error);
      }
      lineItems.push(lineItemResult.value);
    }

    let payment: BillPayment | null = null;
    if (raw.payment) {
      const paymentResult = this.paymentToDomain(raw.payment);
      if (paymentResult.isFailure) {
        return Result.fail<Bill>(paymentResult.error);
      }
      payment = paymentResult.value;
    }

    return Result.ok<Bill>(
      Bill.reconstitute(idResult.value, {
        customerId: customerIdResult.value,
        period: periodResult.value,
        status: this.mapStatusFromPrisma(raw.status),
        lineItems,
        issueDate: raw.issueDate,
        dueDate: raw.dueDate,
        paidAt: raw.paidAt,
        payment,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(bill: Bill): {
    bill: {
      id: string;
      customerId: string;
      periodYear: number;
      periodMonth: number;
      status: PrismaBillStatus;
      issueDate: Date;
      dueDate: Date;
      paidAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    lineItems: {
      id: string;
      billId: string;
      contractedServiceId: string;
      servicePlanId: string;
      planName: string;
      monthlyPrice: number;
      amount: number;
      serviceFrom: Date | null;
      serviceTo: Date | null;
    }[];
    payment: {
      id: string;
      billId: string;
      method: PrismaPaymentMethod;
      reference: string | null;
      amount: number;
      paidAt: Date;
      recordedByUserId: string | null;
    } | null;
  } {
    const billId = bill.id.toString();

    return {
      bill: {
        id: billId,
        customerId: bill.customerId.toString(),
        periodYear: bill.period.year,
        periodMonth: bill.period.month,
        status: this.mapStatusToPrisma(bill.status),
        issueDate: bill.issueDate,
        dueDate: bill.dueDate,
        paidAt: bill.paidAt,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt
      },
      lineItems: bill.lineItems.map((item) => ({
        id: crypto.randomUUID(),
        billId,
        contractedServiceId: item.contractedServiceId.toString(),
        servicePlanId: item.servicePlanId.toString(),
        planName: item.planName,
        monthlyPrice: item.monthlyPrice.toNumber(),
        amount: item.amount.toNumber(),
        serviceFrom: item.servicePeriod?.from ?? null,
        serviceTo: item.servicePeriod?.to ?? null
      })),
      payment:
        bill.payment === null
          ? null
          : {
              id: crypto.randomUUID(),
              billId,
              method: bill.payment.method,
              reference: bill.payment.reference,
              amount: bill.payment.amount.toNumber(),
              paidAt: bill.payment.paidAt,
              recordedByUserId:
                bill.payment.recordedBy?.toString() ?? null
            }
    };
  }

  private static paymentToDomain(
    raw: BillPaymentRecord
  ): Result<BillPayment> {
    const methods = Object.values(PaymentMethod) as string[];
    if (!methods.includes(raw.method)) {
      return Result.fail<BillPayment>(
        `Data integrity violation: unrecognised PaymentMethod "${raw.method}"`
      );
    }

    const amountResult = Money.create(Number(raw.amount));
    if (amountResult.isFailure) {
      return Result.fail<BillPayment>(
        `Invalid payment amount: ${amountResult.error}`
      );
    }

    let recordedBy: UserId | null = null;
    if (raw.recordedByUserId !== null) {
      const userIdResult = UserId.parse(raw.recordedByUserId);
      if (userIdResult.isFailure) {
        return Result.fail<BillPayment>(
          `Invalid recordedByUserId: ${userIdResult.error}`
        );
      }
      recordedBy = userIdResult.value;
    }

    return Result.ok(
      BillPayment.reconstitute({
        method: raw.method as PaymentMethod,
        reference: raw.reference,
        amount: amountResult.value,
        paidAt: raw.paidAt,
        recordedBy
      })
    );
  }

  private static lineItemToDomain(
    raw: BillLineItemRecord
  ): Result<BillLineItem> {
    const contractedServiceIdResult = ContractedServiceId.parse(
      raw.contractedServiceId
    );
    if (contractedServiceIdResult.isFailure) {
      return Result.fail<BillLineItem>(
        `Invalid contracted service id: ${contractedServiceIdResult.error}`
      );
    }

    const servicePlanIdResult = ServicePlanId.parse(
      raw.servicePlanId
    );
    if (servicePlanIdResult.isFailure) {
      return Result.fail<BillLineItem>(
        `Invalid service plan id: ${servicePlanIdResult.error}`
      );
    }

    // Prisma stores price as Decimal — normalise to number before use.
    const moneyResult = Money.create(Number(raw.monthlyPrice));
    if (moneyResult.isFailure) {
      return Result.fail<BillLineItem>(
        `Invalid monthly price: ${moneyResult.error}`
      );
    }

    const amountResult = Money.create(Number(raw.amount));
    if (amountResult.isFailure) {
      return Result.fail<BillLineItem>(
        `Invalid amount: ${amountResult.error}`
      );
    }

    let servicePeriod: ServicePeriod | null = null;
    if (raw.serviceFrom !== null && raw.serviceTo !== null) {
      const periodResult = ServicePeriod.create(
        raw.serviceFrom,
        raw.serviceTo
      );
      if (periodResult.isFailure) {
        return Result.fail<BillLineItem>(
          `Invalid service period: ${periodResult.error}`
        );
      }
      servicePeriod = periodResult.value;
    }

    return BillLineItem.create({
      contractedServiceId: contractedServiceIdResult.value,
      servicePlanId: servicePlanIdResult.value,
      planName: raw.planName,
      monthlyPrice: moneyResult.value,
      amount: amountResult.value,
      servicePeriod
    });
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapStatusFromPrisma(status: string): BillStatus {
    switch (status) {
      case 'PENDING':
        return BillStatus.PENDING;
      case 'PAID':
        return BillStatus.PAID;
      case 'OVERDUE':
        return BillStatus.OVERDUE;
      case 'CANCELLED':
        return BillStatus.CANCELLED;
      default:
        throw new Error(
          `Data integrity violation: unrecognised BillStatus "${status}" in persistence store`
        );
    }
  }

  private static mapStatusToPrisma(
    status: BillStatus
  ): PrismaBillStatus {
    switch (status) {
      case BillStatus.PENDING:
        return 'PENDING';
      case BillStatus.PAID:
        return 'PAID';
      case BillStatus.OVERDUE:
        return 'OVERDUE';
      case BillStatus.CANCELLED:
        return 'CANCELLED';
      default:
        throw new Error(`Unknown domain BillStatus: ${status}`);
    }
  }
}
