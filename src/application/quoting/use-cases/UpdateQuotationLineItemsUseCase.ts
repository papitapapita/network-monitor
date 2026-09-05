import { QuotationLineItem } from 'domain/quoting';
import { IQuotationRepository } from 'domain/quoting/repository';
import { IDeviceModelRepository } from 'domain/device-inventory/repository';
import { DeviceModelId, QuotationId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  UpdateQuotationLineItemsRequestDTO,
  QuotationResponseDTO
} from '../dtos';

export class UpdateQuotationLineItemsUseCase extends UseCase<
  UpdateQuotationLineItemsRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    private readonly deviceModelRepository: IDeviceModelRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateQuotationLineItemsUseCase');
  }

  protected async beforeExecute(
    request: UpdateQuotationLineItemsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    if (!request.lineItems || request.lineItems.length === 0) {
      return Result.fail('At least one line item is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateQuotationLineItemsRequestDTO
  ): Promise<Result<QuotationResponseDTO>> {
    const idResult = QuotationId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid quotation ID: ${idResult.error}`);
    }

    const findResult = await this.quotationRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Quotation not found: ${request.id}`);
    }
    const quotation = findResult.value;

    const lineItemsResult = await this.buildLineItems(
      request.lineItems
    );
    if (lineItemsResult.isFailure) {
      return this.fail(lineItemsResult.error!);
    }

    const replaceResult = quotation.replaceLineItems(
      lineItemsResult.value
    );
    if (replaceResult.isFailure) {
      return this.fail(replaceResult.error!);
    }

    const saveResult = await this.quotationRepository.save(quotation);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist quotation: ${saveResult.error}`
      );
    }

    return this.ok(QuotationMapper.toDTO(saveResult.value));
  }

  private async buildLineItems(
    requestedItems: UpdateQuotationLineItemsRequestDTO['lineItems']
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
