import {
  CollectionAccount,
  CollectionAccountLineItem
} from 'domain/billing';
import { ICollectionAccountRepository } from 'domain/billing/repository';
import { ICustomerRepository } from 'domain/customers/repository';
import { CustomerId, UserId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CollectionAccountMapper } from '../mappers';
import {
  CreateCollectionAccountRequestDTO,
  CollectionAccountResponseDTO
} from '../dtos';

interface ResolvedCustomer {
  customerId: CustomerId | null;
  customerName: string;
  customerDocument: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
}

export class CreateCollectionAccountUseCase extends UseCase<
  CreateCollectionAccountRequestDTO,
  CollectionAccountResponseDTO
> {
  constructor(
    private readonly collectionAccountRepository: ICollectionAccountRepository,
    private readonly customerRepository: ICustomerRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateCollectionAccountUseCase');
  }

  protected async beforeExecute(
    request: CreateCollectionAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.lineItems || request.lineItems.length === 0) {
      return Result.fail('At least one line item is required');
    }
    const hasCustomerId =
      !!request.customerId && request.customerId.trim().length > 0;
    const hasCustomerName =
      !!request.customerName &&
      request.customerName.trim().length > 0;
    if (!hasCustomerId && !hasCustomerName) {
      return Result.fail(
        'Either customerId or customerName is required'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: CreateCollectionAccountRequestDTO
  ): Promise<Result<CollectionAccountResponseDTO>> {
    const datesResult = this.parseDates(
      request.issueDate,
      request.dueDate
    );
    if (datesResult.isFailure) {
      return this.fail(datesResult.error!);
    }

    const customerResult = await this.resolveCustomer(request);
    if (customerResult.isFailure) {
      return this.fail(customerResult.error!);
    }

    const lineItemsResult = this.buildLineItems(request.lineItems);
    if (lineItemsResult.isFailure) {
      return this.fail(lineItemsResult.error!);
    }

    let createdBy: UserId | null = null;
    if (request.createdBy) {
      const createdByResult = UserId.parse(request.createdBy.trim());
      if (createdByResult.isFailure) {
        return this.fail(
          `Invalid createdBy: ${createdByResult.error}`
        );
      }
      createdBy = createdByResult.value;
    }

    const collectionAccountResult = CollectionAccount.create({
      ...customerResult.value,
      ...datesResult.value,
      lineItems: lineItemsResult.value,
      notes: this.blankToNull(request.notes),
      createdBy
    });
    if (collectionAccountResult.isFailure) {
      return this.fail(collectionAccountResult.error!);
    }

    const saveResult = await this.collectionAccountRepository.save(
      collectionAccountResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist collection account: ${saveResult.error}`
      );
    }

    return this.ok(CollectionAccountMapper.toDTO(saveResult.value));
  }

  private parseDates(
    issueDateRaw?: string,
    dueDateRaw?: string
  ): Result<{ issueDate: Date; dueDate: Date | null }> {
    const issueDate =
      issueDateRaw !== undefined
        ? new Date(issueDateRaw)
        : new Date();
    if (isNaN(issueDate.getTime())) {
      return Result.fail('issueDate is not a valid date');
    }

    let dueDate: Date | null = null;
    if (dueDateRaw !== undefined) {
      dueDate = new Date(dueDateRaw);
      if (isNaN(dueDate.getTime())) {
        return Result.fail('dueDate is not a valid date');
      }
    }

    return Result.ok({ issueDate, dueDate });
  }

  private async resolveCustomer(
    request: CreateCollectionAccountRequestDTO
  ): Promise<Result<ResolvedCustomer>> {
    if (request.customerId) {
      const customerIdResult = CustomerId.parse(
        request.customerId.trim()
      );
      if (customerIdResult.isFailure) {
        return Result.fail(
          `Invalid customerId: ${customerIdResult.error}`
        );
      }

      const customerResult = await this.customerRepository.findById(
        customerIdResult.value
      );
      if (customerResult.isFailure) {
        return Result.fail(customerResult.error!);
      }
      if (customerResult.value === null) {
        return Result.fail(
          `Customer not found: ${request.customerId}`
        );
      }
      const customer = customerResult.value;

      return Result.ok({
        customerId: customerIdResult.value,
        customerName: customer.fullName,
        customerDocument:
          customer.cedula !== null
            ? customer.cedula.toString()
            : this.blankToNull(request.customerDocument),
        customerPhone: customer.phone.toString(),
        customerEmail:
          customer.email !== null ? customer.email.toString() : null,
        customerAddress: this.blankToNull(request.customerAddress)
      });
    }

    return Result.ok({
      customerId: null,
      customerName: request.customerName!.trim(),
      customerDocument: this.blankToNull(request.customerDocument),
      customerPhone: this.blankToNull(request.customerPhone),
      customerEmail: this.blankToNull(request.customerEmail),
      customerAddress: this.blankToNull(request.customerAddress)
    });
  }

  private buildLineItems(
    requestedItems: CreateCollectionAccountRequestDTO['lineItems']
  ): Result<CollectionAccountLineItem[]> {
    const lineItems: CollectionAccountLineItem[] = [];

    for (const requested of requestedItems) {
      const unitPriceResult = Money.create(requested.unitPrice);
      if (unitPriceResult.isFailure) {
        return Result.fail(
          `Invalid unitPrice: ${unitPriceResult.error}`
        );
      }

      const lineItemResult = CollectionAccountLineItem.create({
        description: requested.description,
        unitPrice: unitPriceResult.value,
        quantity: requested.quantity
      });
      if (lineItemResult.isFailure) {
        return Result.fail(lineItemResult.error!);
      }

      lineItems.push(lineItemResult.value);
    }

    return Result.ok(lineItems);
  }

  private blankToNull(value: string | undefined): string | null {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
