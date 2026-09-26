import { Result } from 'domain/shared/core';
import {
  CollectionAccountId,
  CustomerId,
  UserId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import {
  CollectionAccount,
  CollectionAccountLineItem,
  CollectionAccountStatus
} from 'domain/billing';
import { CollectionAccountStatus as PrismaCollectionAccountStatus } from 'generated/prisma/client';

interface CollectionAccountLineItemRecord {
  id: string;
  collectionAccountId: string;
  description: string;
  unitPrice: number | { toNumber(): number };
  quantity: number;
}

interface CollectionAccountRecord {
  id: string;
  code: number;
  status: string;
  customerId: string | null;
  customerName: string;
  customerDocument: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: CollectionAccountLineItemRecord[];
}

export class CollectionAccountPrismaMapper {
  public static toDomain(
    raw: CollectionAccountRecord
  ): Result<CollectionAccount> {
    const idResult = CollectionAccountId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<CollectionAccount>(
        `Invalid collection account id: ${idResult.error}`
      );
    }

    let customerId: CustomerId | null = null;
    if (raw.customerId !== null) {
      const customerIdResult = CustomerId.parse(raw.customerId);
      if (customerIdResult.isFailure) {
        return Result.fail<CollectionAccount>(
          `Invalid customer id: ${customerIdResult.error}`
        );
      }
      customerId = customerIdResult.value;
    }

    let createdBy: UserId | null = null;
    if (raw.createdBy !== null) {
      const createdByResult = UserId.parse(raw.createdBy);
      if (createdByResult.isFailure) {
        return Result.fail<CollectionAccount>(
          `Invalid createdBy id: ${createdByResult.error}`
        );
      }
      createdBy = createdByResult.value;
    }

    const lineItems: CollectionAccountLineItem[] = [];
    for (const rawItem of raw.lineItems) {
      const lineItemResult = this.lineItemToDomain(rawItem);
      if (lineItemResult.isFailure) {
        return Result.fail<CollectionAccount>(lineItemResult.error);
      }
      lineItems.push(lineItemResult.value);
    }

    return Result.ok<CollectionAccount>(
      CollectionAccount.reconstitute(idResult.value, {
        code: raw.code,
        status: this.mapStatusFromPrisma(raw.status),
        customerId,
        customerName: raw.customerName,
        customerDocument: raw.customerDocument,
        customerPhone: raw.customerPhone,
        customerEmail: raw.customerEmail,
        customerAddress: raw.customerAddress,
        lineItems,
        issueDate: raw.issueDate,
        dueDate: raw.dueDate,
        notes: raw.notes,
        paidAt: raw.paidAt,
        cancelledAt: raw.cancelledAt,
        createdBy,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(collectionAccount: CollectionAccount): {
    collectionAccount: {
      id: string;
      status: PrismaCollectionAccountStatus;
      customerId: string | null;
      customerName: string;
      customerDocument: string | null;
      customerPhone: string | null;
      customerEmail: string | null;
      customerAddress: string | null;
      issueDate: Date;
      dueDate: Date | null;
      notes: string | null;
      paidAt: Date | null;
      cancelledAt: Date | null;
      createdBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    lineItems: {
      id: string;
      collectionAccountId: string;
      description: string;
      unitPrice: number;
      quantity: number;
    }[];
  } {
    const collectionAccountId = collectionAccount.id.toString();

    return {
      // `code` is omitted: the database sequence owns it and is only known
      // once the row is read back after save.
      collectionAccount: {
        id: collectionAccountId,
        status: this.mapStatusToPrisma(collectionAccount.status),
        customerId:
          collectionAccount.customerId !== null
            ? collectionAccount.customerId.toString()
            : null,
        customerName: collectionAccount.customerName,
        customerDocument: collectionAccount.customerDocument,
        customerPhone: collectionAccount.customerPhone,
        customerEmail: collectionAccount.customerEmail,
        customerAddress: collectionAccount.customerAddress,
        issueDate: collectionAccount.issueDate,
        dueDate: collectionAccount.dueDate,
        notes: collectionAccount.notes,
        paidAt: collectionAccount.paidAt,
        cancelledAt: collectionAccount.cancelledAt,
        createdBy:
          collectionAccount.createdBy !== null
            ? collectionAccount.createdBy.toString()
            : null,
        createdAt: collectionAccount.createdAt,
        updatedAt: collectionAccount.updatedAt
      },
      lineItems: collectionAccount.lineItems.map((item) => ({
        id: crypto.randomUUID(),
        collectionAccountId,
        description: item.description,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity
      }))
    };
  }

  private static lineItemToDomain(
    raw: CollectionAccountLineItemRecord
  ): Result<CollectionAccountLineItem> {
    // Prisma stores price as Decimal — normalise to number before use.
    const moneyResult = Money.create(Number(raw.unitPrice));
    if (moneyResult.isFailure) {
      return Result.fail<CollectionAccountLineItem>(
        `Invalid unit price: ${moneyResult.error}`
      );
    }

    return CollectionAccountLineItem.create({
      description: raw.description,
      unitPrice: moneyResult.value,
      quantity: raw.quantity
    });
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapStatusFromPrisma(
    status: string
  ): CollectionAccountStatus {
    switch (status) {
      case 'PENDING':
        return CollectionAccountStatus.PENDING;
      case 'PAID':
        return CollectionAccountStatus.PAID;
      case 'CANCELLED':
        return CollectionAccountStatus.CANCELLED;
      default:
        throw new Error(
          `Data integrity violation: unrecognised CollectionAccountStatus "${status}" in persistence store`
        );
    }
  }

  private static mapStatusToPrisma(
    status: CollectionAccountStatus
  ): PrismaCollectionAccountStatus {
    switch (status) {
      case CollectionAccountStatus.PENDING:
        return 'PENDING';
      case CollectionAccountStatus.PAID:
        return 'PAID';
      case CollectionAccountStatus.CANCELLED:
        return 'CANCELLED';
      default:
        throw new Error(
          `Unknown domain CollectionAccountStatus: ${status}`
        );
    }
  }
}
