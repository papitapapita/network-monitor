import { ICollectionAccountRepository } from 'domain/billing/repository';
import { CollectionAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CollectionAccountMapper } from '../mappers';
import {
  CancelCollectionAccountRequestDTO,
  CollectionAccountResponseDTO
} from '../dtos';

export class CancelCollectionAccountUseCase extends UseCase<
  CancelCollectionAccountRequestDTO,
  CollectionAccountResponseDTO
> {
  constructor(
    private readonly collectionAccountRepository: ICollectionAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'CancelCollectionAccountUseCase');
  }

  protected async beforeExecute(
    request: CancelCollectionAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Collection account ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CancelCollectionAccountRequestDTO
  ): Promise<Result<CollectionAccountResponseDTO>> {
    const idResult = CollectionAccountId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(
        `Invalid collection account ID: ${idResult.error}`
      );
    }

    const findResult =
      await this.collectionAccountRepository.findById(idResult.value);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Collection account not found: ${request.id}`);
    }

    const collectionAccount = findResult.value;
    const transitionResult = collectionAccount.cancel();
    if (transitionResult.isFailure) {
      return this.fail(transitionResult.error!);
    }

    const saveResult =
      await this.collectionAccountRepository.save(collectionAccount);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist collection account: ${saveResult.error}`
      );
    }

    return this.ok(CollectionAccountMapper.toDTO(saveResult.value));
  }
}
