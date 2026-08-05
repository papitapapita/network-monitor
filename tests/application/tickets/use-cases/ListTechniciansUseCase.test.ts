// Source: src/application/tickets/use-cases/ListTechniciansUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ListTechniciansUseCase } from '../../../../src/application/tickets/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import {
  makeLogger,
  makeTechnicianRepo,
  makeTechnician
} from './mocks';

describe('ListTechniciansUseCase', () => {
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: ListTechniciansUseCase;

  beforeEach(() => {
    technicianRepo = makeTechnicianRepo();
    useCase = new ListTechniciansUseCase(
      technicianRepo,
      makeLogger()
    );

    (technicianRepo.findAll as any).mockResolvedValue(
      Result.ok([makeTechnician()])
    );
    (technicianRepo.count as any).mockResolvedValue(Result.ok(1));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to a page of 20 from offset 0', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(technicianRepo.findAll).toHaveBeenCalledWith(
      undefined,
      20,
      0
    );
  });

  it('passes activeOnly through to both the query and the count', async () => {
    await useCase.execute({ activeOnly: true });

    expect(technicianRepo.findAll).toHaveBeenCalledWith(true, 20, 0);
    expect(technicianRepo.count).toHaveBeenCalledWith(true);
  });

  it('caps the page size at 100', async () => {
    await useCase.execute({ limit: 5000 });

    expect(technicianRepo.findAll).toHaveBeenCalledWith(
      undefined,
      100,
      0
    );
  });

  it('rejects a negative offset', async () => {
    const result = await useCase.execute({ offset: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('negative');
  });

  it('rejects a limit below one', async () => {
    const result = await useCase.execute({ limit: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('at least 1');
  });

  it('propagates a repository failure', async () => {
    (technicianRepo.findAll as any).mockResolvedValue(
      Result.fail('Database error finding all technicians')
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });

  it('propagates a count failure', async () => {
    (technicianRepo.count as any).mockResolvedValue(
      Result.fail('Database error counting technicians')
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
