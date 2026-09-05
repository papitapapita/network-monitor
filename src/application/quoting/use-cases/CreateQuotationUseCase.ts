import { Quotation, QuotationLineItem } from 'domain/quoting';
import { IQuotationRepository } from 'domain/quoting/repository';
import { ICustomerRepository } from 'domain/customers/repository';
import { IDeviceModelRepository } from 'domain/device-inventory/repository';
import { CustomerId, DeviceModelId, UserId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  CreateQuotationRequestDTO,
  QuotationResponseDTO
} from '../dtos';

interface ResolvedCustomer {
  customerId: CustomerId | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
}

export class CreateQuotationUseCase extends UseCase<
  CreateQuotationRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly deviceModelRepository: IDeviceModelRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateQuotationUseCase');
  }

  protected async beforeExecute(
    request: CreateQuotationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.lineItems || request.lineItems.length === 0) {
      return Result.fail('At least one line item is required');
    }
    if (!request.validUntil) {
      return Result.fail('validUntil is required');
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
    request: CreateQuotationRequestDTO
  ): Promise<Result<QuotationResponseDTO>> {
    const validUntil = new Date(request.validUntil);
    if (isNaN(validUntil.getTime())) {
      return this.fail('validUntil is not a valid date');
    }

    const customerResult = await this.resolveCustomer(request);
    if (customerResult.isFailure) {
      return this.fail(customerResult.error!);
    }

    const lineItemsResult = await this.buildLineItems(
      request.lineItems
    );
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

    const quotationResult = Quotation.create({
      ...customerResult.value,
      lineItems: lineItemsResult.value,
      validUntil,
      notes: request.notes ?? null,
      createdBy
    });
    if (quotationResult.isFailure) {
      return this.fail(quotationResult.error!);
    }

    const saveResult = await this.quotationRepository.save(
      quotationResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist quotation: ${saveResult.error}`
      );
    }

    return this.ok(QuotationMapper.toDTO(saveResult.value));
  }

  private async resolveCustomer(
    request: CreateQuotationRequestDTO
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
        customerPhone: customer.phone.toString(),
        customerEmail:
          customer.email !== null ? customer.email.toString() : null,
        customerAddress: request.customerAddress ?? null
      });
    }

    return Result.ok({
      customerId: null,
      customerName: request.customerName!.trim(),
      customerPhone: request.customerPhone ?? null,
      customerEmail: request.customerEmail ?? null,
      customerAddress: request.customerAddress ?? null
    });
  }

  private async buildLineItems(
    requestedItems: CreateQuotationRequestDTO['lineItems']
  ): Promise<Result<QuotationLineItem[]>> {
    const lineItems: QuotationLineItem[] = [];

    for (const requested of requestedItems) {
      const deviceModelIdResult = DeviceModelId.parse(
        requested.deviceModelId
      );
      if (deviceModelIdResult.isFailure) {
        return Result.fail(
          `Invalid deviceModelId: ${deviceModelIdResult.error}`
        );
      }

      const deviceModelResult =
        await this.deviceModelRepository.findById(
          deviceModelIdResult.value
        );
      if (deviceModelResult.isFailure) {
        return Result.fail(deviceModelResult.error!);
      }
      if (deviceModelResult.value === null) {
        return Result.fail(
          `Device model not found: ${requested.deviceModelId}`
        );
      }
      const deviceModel = deviceModelResult.value;

      const unitPriceResult = Money.create(requested.unitPrice);
      if (unitPriceResult.isFailure) {
        return Result.fail(
          `Invalid unitPrice: ${unitPriceResult.error}`
        );
      }

      const lineItemResult = QuotationLineItem.create({
        deviceModelId: deviceModel.id,
        deviceModelName: `${deviceModel.vendorName} ${deviceModel.model}`,
        vendorName: deviceModel.vendorName,
        deviceType: deviceModel.deviceType.value,
        imageUrl: deviceModel.imageUrl,
        description:
          requested.description ??
          `${deviceModel.vendorName} ${deviceModel.model}`,
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
}
