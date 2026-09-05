import { Quotation, QuotationLineItem } from 'domain/quoting';
import {
  QuotationLineItemDTO,
  QuotationResponseDTO,
  QuotationListResponseDTO
} from '../dtos';

export class QuotationMapper {
  public static toDTO(quotation: Quotation): QuotationResponseDTO {
    return {
      id: quotation.id.toString(),
      code: quotation.code,
      status: quotation.status,
      customerId:
        quotation.customerId !== null
          ? quotation.customerId.toString()
          : null,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      customerEmail: quotation.customerEmail,
      customerAddress: quotation.customerAddress,
      lineItems: quotation.lineItems.map((item) =>
        this.toLineItemDTO(item)
      ),
      subtotal: quotation.subtotal.toNumber(),
      total: quotation.total.toNumber(),
      validUntil: quotation.validUntil.toISOString(),
      notes: quotation.notes,
      sentAt:
        quotation.sentAt !== null
          ? quotation.sentAt.toISOString()
          : null,
      acceptedAt:
        quotation.acceptedAt !== null
          ? quotation.acceptedAt.toISOString()
          : null,
      rejectedAt:
        quotation.rejectedAt !== null
          ? quotation.rejectedAt.toISOString()
          : null,
      rejectionReason: quotation.rejectionReason,
      expiredAt:
        quotation.expiredAt !== null
          ? quotation.expiredAt.toISOString()
          : null,
      createdBy:
        quotation.createdBy !== null
          ? quotation.createdBy.toString()
          : null,
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    quotations: Quotation[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): QuotationListResponseDTO {
    return {
      quotations: quotations.map((q) => this.toDTO(q)),
      total,
      hasMore: offset + quotations.length < total,
      limit,
      offset
    };
  }

  private static toLineItemDTO(
    item: QuotationLineItem
  ): QuotationLineItemDTO {
    return {
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
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber()
    };
  }
}
