// Source: src/application/notifications/use-cases/SetMutedAlertTypesUseCase.ts

import { SetMutedAlertTypesUseCase } from '../../../../src/application/notifications/use-cases/SetMutedAlertTypesUseCase';
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

describe('SetMutedAlertTypesUseCase', () => {
  let repo: jest.Mocked<IMutedAlertTypeRepository>;
  let useCase: SetMutedAlertTypesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new SetMutedAlertTypesUseCase(repo, makeLogger());
  });

  it('fails when metrics is not an array', async () => {
    const result = await useCase.execute({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metrics: 'cpu_load_percent' as any
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('metrics must be an array');
    expect(repo.replaceAll).not.toHaveBeenCalled();
  });

  it('replaces the whole set and returns the new metric list', async () => {
    repo.replaceAll.mockResolvedValue(
      Result.ok([MutedAlertType.create('cpu_load_percent').value])
    );

    const result = await useCase.execute({
      metrics: ['cpu_load_percent']
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.metrics).toEqual(['cpu_load_percent']);
    expect(repo.replaceAll).toHaveBeenCalledWith([
      'cpu_load_percent'
    ]);
  });

  it('accepts an empty array to clear every mute', async () => {
    repo.replaceAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute({ metrics: [] });

    expect(result.isSuccess).toBe(true);
    expect(result.value.metrics).toEqual([]);
  });

  it('fails when the repository rejects an invalid metric', async () => {
    repo.replaceAll.mockResolvedValue(
      Result.fail('metric must be lowercase letters, digits and underscores')
    );

    const result = await useCase.execute({
      metrics: ['Not Valid!']
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'Failed to update muted alert types'
    );
  });
});
