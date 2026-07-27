import { Result } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import {
  IContractedServiceRepository,
  ICustomerRepository
} from 'domain/customers/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ICustomerNotificationService } from '../interfaces';
import {
  SendSuspensionNoticeDTO,
  SuspensionNoticeResponseDTO
} from '../dtos';

export class SendSuspensionNoticeUseCase extends UseCase<
  SendSuspensionNoticeDTO,
  SuspensionNoticeResponseDTO
> {
  constructor(
    private readonly contractedServiceRepo: IContractedServiceRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly customerNotificationService: ICustomerNotificationService,
    logger: ILogger
  ) {
    super(logger, 'SendSuspensionNoticeUseCase');
  }

  protected async beforeExecute(
    request: SendSuspensionNoticeDTO
  ): Promise<Result<void> | null> {
    if (!request.contractedServiceId?.trim()) {
      return Result.fail('contractedServiceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: SendSuspensionNoticeDTO
  ): Promise<Result<SuspensionNoticeResponseDTO>> {
    const serviceIdResult = ContractedServiceId.parse(
      request.contractedServiceId
    );
    if (serviceIdResult.isFailure) {
      return this.fail(
        `Invalid contracted service ID: ${serviceIdResult.error}`
      );
    }

    const serviceResult = await this.contractedServiceRepo.findById(
      serviceIdResult.value
    );
    if (serviceResult.isFailure) {
      return this.fail(
        `Failed to load contracted service: ${serviceResult.error}`
      );
    }
    const service = serviceResult.value;
    if (!service) {
      return this.fail('Contracted service not found');
    }

    const customerResult = await this.customerRepo.findById(
      service.customerId
    );
    if (customerResult.isFailure) {
      return this.fail(
        `Failed to load customer: ${customerResult.error}`
      );
    }
    const customer = customerResult.value;
    if (!customer) {
      return this.fail('Customer not found');
    }

    const sendResult =
      await this.customerNotificationService.sendTemplate(
        customer.phone,
        { bodyParams: [customer.fullName] }
      );
    if (sendResult.isFailure) {
      return this.fail(
        `Failed to send suspension notice: ${sendResult.error}`
      );
    }

    return this.ok({
      contractedServiceId: request.contractedServiceId,
      customerId: service.customerId.toString(),
      sentAt: new Date().toISOString()
    });
  }
}
