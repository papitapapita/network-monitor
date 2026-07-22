import { Result } from 'domain/shared/core';
import {
  BillId,
  CustomerId,
  ContractedServiceId,
  ServicePlanId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Bill } from 'domain/billing/aggregates';
import { BillStatus } from 'domain/billing/enums';
import {
  BillingPeriod,
  BillLineItem
} from 'domain/billing/value-objects';
import { BillStatus as PrismaBillStatus } from 'generated/prisma/client';

interface BillLineItemRecord {
  id: string;
  billId: string;
  contractedServiceId: string;
  servicePlanId: string;
  planName: string;
  monthlyPrice: number | { toNumber(): number };
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

    return Result.ok<Bill>(
      Bill.reconstitute(idResult.value, {
        customerId: customerIdResult.value,
        period: periodResult.value,
        status: this.mapStatusFromPrisma(raw.status),
        lineItems,
        issueDate: raw.issueDate,
        dueDate: raw.dueDate,
        paidAt: raw.paidAt,
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
    }[];
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
        monthlyPrice: item.monthlyPrice.toNumber()
      }))
    };
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

    return BillLineItem.create({
      contractedServiceId: contractedServiceIdResult.value,
      servicePlanId: servicePlanIdResult.value,
      planName: raw.planName,
      monthlyPrice: moneyResult.value
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
