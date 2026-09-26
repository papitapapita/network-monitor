import {
  CollectionAccount,
  CollectionAccountLineItem
} from 'domain/billing';
import {
  CollectionAccountLineItemDTO,
  CollectionAccountResponseDTO,
  CollectionAccountListResponseDTO
} from '../dtos';

export class CollectionAccountMapper {
  public static toDTO(
    collectionAccount: CollectionAccount
  ): CollectionAccountResponseDTO {
    return {
      id: collectionAccount.id.toString(),
      code: collectionAccount.code,
      number: this.formatNumber(collectionAccount.code),
      status: collectionAccount.status,
      customerId:
        collectionAccount.customerId !== null
          ? collectionAccount.customerId.toString()
          : null,
      customerName: collectionAccount.customerName,
      customerDocument: collectionAccount.customerDocument,
      customerPhone: collectionAccount.customerPhone,
      customerEmail: collectionAccount.customerEmail,
      customerAddress: collectionAccount.customerAddress,
      lineItems: collectionAccount.lineItems.map((item) =>
        this.toLineItemDTO(item)
      ),
      total: collectionAccount.total.toNumber(),
      issueDate: collectionAccount.issueDate.toISOString(),
      dueDate:
        collectionAccount.dueDate !== null
          ? collectionAccount.dueDate.toISOString()
          : null,
      notes: collectionAccount.notes,
      paidAt:
        collectionAccount.paidAt !== null
          ? collectionAccount.paidAt.toISOString()
          : null,
      cancelledAt:
        collectionAccount.cancelledAt !== null
          ? collectionAccount.cancelledAt.toISOString()
          : null,
      createdBy:
        collectionAccount.createdBy !== null
          ? collectionAccount.createdBy.toString()
          : null,
      createdAt: collectionAccount.createdAt.toISOString(),
      updatedAt: collectionAccount.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    collectionAccounts: CollectionAccount[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): CollectionAccountListResponseDTO {
    return {
      collectionAccounts: collectionAccounts.map((c) =>
        this.toDTO(c)
      ),
      total,
      hasMore: offset + collectionAccounts.length < total,
      limit,
      offset
    };
  }

  public static formatNumber(code: number | null): string | null {
    if (code === null) return null;
    return `CC-${String(code).padStart(4, '0')}`;
  }

  private static toLineItemDTO(
    item: CollectionAccountLineItem
  ): CollectionAccountLineItemDTO {
    return {
      description: item.description,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber()
    };
  }
}
