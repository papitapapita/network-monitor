import { Result } from 'domain/shared/core';
import { ISpeedTestResultRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { SpeedTestMapper } from '../mappers';
import { ListSpeedTestsDTO, SpeedTestListResponseDTO } from '../dtos';

export const SPEED_TESTS_DEFAULT_LIMIT = 20;
export const SPEED_TESTS_MAX_LIMIT = 100;

// MON-103: every kept speed test, newest first.
export class ListSpeedTestsUseCase extends UseCase<
  ListSpeedTestsDTO,
  SpeedTestListResponseDTO
> {
  constructor(
    private readonly repository: ISpeedTestResultRepository,
    logger: ILogger
  ) {
    super(logger, 'ListSpeedTestsUseCase');
  }

  protected async executeImpl(
    request: ListSpeedTestsDTO
  ): Promise<Result<SpeedTestListResponseDTO>> {
    const limit = request.limit ?? SPEED_TESTS_DEFAULT_LIMIT;
    const offset = request.offset ?? 0;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > SPEED_TESTS_MAX_LIMIT
    ) {
      return this.fail(
        `limit must be between 1 and ${SPEED_TESTS_MAX_LIMIT}`
      );
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return this.fail('offset must be 0 or more');
    }

    const page = await this.repository.list({ limit, offset });
    if (page.isFailure) {
      return this.fail(`Failed to list speed tests: ${page.error}`);
    }

    const { results, total } = page.value;
    return this.ok({
      results: results.map(SpeedTestMapper.toDTO),
      total,
      hasMore: offset + results.length < total,
      limit,
      offset
    });
  }
}
