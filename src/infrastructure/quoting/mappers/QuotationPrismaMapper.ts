import { Result } from 'domain/shared/core';
import {
  CustomerId,
  DeviceModelId,
  QuotationId,
  UserId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import {
  Quotation,
  QuotationLineItem,
  QuotationStatus
} from 'domain/quoting';
import { QuotationStatus as PrismaQuotationStatus } from 'generated/prisma/client';

interface QuotationLineItemRecord {
  id: string;
  quotationId: string;
  deviceModelId: string | null;
  deviceModelName: string;
  vendorName: string;
  deviceType: string;
  imageUrl: string | null;
  description: string;
  unitPrice: number | { toNumber(): number };
  quantity: number;
}

interface QuotationRecord {
  id: string;
  code: number;
  status: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  validUntil: Date;
  notes: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiredAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: QuotationLineItemRecord[];
}

export class QuotationPrismaMapper {
  public static toDomain(raw: QuotationRecord): Result<Quotation> {
    const idResult = QuotationId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Quotation>(
        `Invalid quotation id: ${idResult.error}`
      );
    }

    let customerId: CustomerId | null = null;
    if (raw.customerId !== null) {
      const customerIdResult = CustomerId.parse(raw.customerId);
      if (customerIdResult.isFailure) {
        return Result.fail<Quotation>(
          `Invalid customer id: ${customerIdResult.error}`
        );
      }
      customerId = customerIdResult.value;
    }

    let createdBy: UserId | null = null;
    if (raw.createdBy !== null) {
      const createdByResult = UserId.parse(raw.createdBy);
      if (createdByResult.isFailure) {
        return Result.fail<Quotation>(
          `Invalid createdBy id: ${createdByResult.error}`
        );
      }
      createdBy = createdByResult.value;
    }

    const lineItems: QuotationLineItem[] = [];
    for (const rawItem of raw.lineItems) {
      const lineItemResult = this.lineItemToDomain(rawItem);
      if (lineItemResult.isFailure) {
        return Result.fail<Quotation>(lineItemResult.error);
      }
      lineItems.push(lineItemResult.value);
    }

    return Result.ok<Quotation>(
      Quotation.reconstitute(idResult.value, {
        code: raw.code,
        status: this.mapStatusFromPrisma(raw.status),
        customerId,
        customerName: raw.customerName,
        customerPhone: raw.customerPhone,
        customerEmail: raw.customerEmail,
        customerAddress: raw.customerAddress,
        lineItems,
        validUntil: raw.validUntil,
        notes: raw.notes,
        sentAt: raw.sentAt,
        acceptedAt: raw.acceptedAt,
        rejectedAt: raw.rejectedAt,
        rejectionReason: raw.rejectionReason,
        expiredAt: raw.expiredAt,
        createdBy,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(quotation: Quotation): {
    quotation: {
      id: string;
      status: PrismaQuotationStatus;
      customerId: string | null;
      customerName: string;
      customerPhone: string | null;
      customerEmail: string | null;
      customerAddress: string | null;
      validUntil: Date;
      notes: string | null;
      sentAt: Date | null;
      acceptedAt: Date | null;
      rejectedAt: Date | null;
      rejectionReason: string | null;
      expiredAt: Date | null;
      createdBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    lineItems: {
      id: string;
      quotationId: string;
      deviceModelId: string | null;
      deviceModelName: string;
      vendorName: string;
      deviceType: string;
      imageUrl: string | null;
      description: string;
      unitPrice: number;
      quantity: number;
    }[];
  } {
    const quotationId = quotation.id.toString();

    return {
      // `code` is omitted: the database sequence owns it and is only known
      // once the row is read back after save.
      quotation: {
        id: quotationId,
        status: this.mapStatusToPrisma(quotation.status),
        customerId:
          quotation.customerId !== null
            ? quotation.customerId.toString()
            : null,
        customerName: quotation.customerName,
        customerPhone: quotation.customerPhone,
        customerEmail: quotation.customerEmail,
        customerAddress: quotation.customerAddress,
        validUntil: quotation.validUntil,
        notes: quotation.notes,
        sentAt: quotation.sentAt,
        acceptedAt: quotation.acceptedAt,
        rejectedAt: quotation.rejectedAt,
        rejectionReason: quotation.rejectionReason,
        expiredAt: quotation.expiredAt,
        createdBy:
          quotation.createdBy !== null
            ? quotation.createdBy.toString()
            : null,
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt
      },
      lineItems: quotation.lineItems.map((item) => ({
        id: crypto.randomUUID(),
        quotationId,
        deviceModelId:
          item.deviceModelId !== null
            ? item.deviceModelId.toString()
            : null,
        deviceModelName: item.deviceModelName,
        vendorName: item.vendorName,
        deviceType: item.deviceType,
        imageUrl: item.imageUrl,
        description: item.description,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity
      }))
    };
  }

  private static lineItemToDomain(
    raw: QuotationLineItemRecord
  ): Result<QuotationLineItem> {
    let deviceModelId: DeviceModelId | null = null;
    if (raw.deviceModelId !== null) {
      const deviceModelIdResult = DeviceModelId.parse(
        raw.deviceModelId
      );
      if (deviceModelIdResult.isFailure) {
        return Result.fail<QuotationLineItem>(
          `Invalid device model id: ${deviceModelIdResult.error}`
        );
      }
      deviceModelId = deviceModelIdResult.value;
    }

    // Prisma stores price as Decimal — normalise to number before use.
    const moneyResult = Money.create(Number(raw.unitPrice));
    if (moneyResult.isFailure) {
      return Result.fail<QuotationLineItem>(
        `Invalid unit price: ${moneyResult.error}`
      );
    }

    return QuotationLineItem.create({
      deviceModelId,
      deviceModelName: raw.deviceModelName,
      vendorName: raw.vendorName,
      deviceType: raw.deviceType,
      imageUrl: raw.imageUrl,
      description: raw.description,
      unitPrice: moneyResult.value,
      quantity: raw.quantity
    });
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapStatusFromPrisma(
    status: string
  ): QuotationStatus {
    switch (status) {
      case 'DRAFT':
        return QuotationStatus.DRAFT;
      case 'SENT':
        return QuotationStatus.SENT;
      case 'ACCEPTED':
        return QuotationStatus.ACCEPTED;
      case 'REJECTED':
        return QuotationStatus.REJECTED;
      case 'EXPIRED':
        return QuotationStatus.EXPIRED;
      default:
        throw new Error(
          `Data integrity violation: unrecognised QuotationStatus "${status}" in persistence store`
        );
    }
  }

  private static mapStatusToPrisma(
    status: QuotationStatus
  ): PrismaQuotationStatus {
    switch (status) {
      case QuotationStatus.DRAFT:
        return 'DRAFT';
      case QuotationStatus.SENT:
        return 'SENT';
      case QuotationStatus.ACCEPTED:
        return 'ACCEPTED';
      case QuotationStatus.REJECTED:
        return 'REJECTED';
      case QuotationStatus.EXPIRED:
        return 'EXPIRED';
      default:
        throw new Error(`Unknown domain QuotationStatus: ${status}`);
    }
  }
}
