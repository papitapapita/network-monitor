// Source: src/application/notifications/use-cases/GetMutedAlertTypesUseCase.ts

import { GetMutedAlertTypesUseCase } from '../../../../src/application/notifications/use-cases/GetMutedAlertTypesUseCase';
import { IMutedAlertTypeRepository } from '../../../../src/domain/notifications/repository/IMutedAlertTypeRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { MutedAlertType } from '../../../../src/domain/notifications/entities/MutedAlertType';

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeRepo(): jest.Mocked<IMutedAlertTypeRepository> {
  return {
    listAll: jest.fn(),
    isMuted: jest.fn(),
    replaceAll: jest.fn()
  };
}

describe('GetMutedAlertTypesUseCase', () => {
  let repo: jest.Mocked<IMutedAlertTypeRepository>;
  let useCase: GetMutedAlertTypesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetMutedAlertTypesUseCase(repo, makeLogger());
  });

  it('returns the metric names of every muted alert type', async () => {
    repo.listAll.mockResolvedValue(
      Result.ok([
        MutedAlertType.create('cpu_load_percent').value,
        MutedAlertType.create('distance_m').value
      ])
    );

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.metrics).toEqual([
      'cpu_load_percent',
      'distance_m'
    ]);
  });

  it('returns an empty list when nothing is muted', async () => {
    repo.listAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.metrics).toEqual([]);
  });

  it('fails when the repository fails', async () => {
    repo.listAll.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Failed to load muted alert types'
    );
  });
});
