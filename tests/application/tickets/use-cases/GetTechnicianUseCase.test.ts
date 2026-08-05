// Source: src/application/tickets/use-cases/GetTechnicianUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetTechnicianUseCase } from '../../../../src/application/tickets/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTechnicianRepo,
  makeTechnician
} from './mocks';

describe('GetTechnicianUseCase', () => {
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: GetTechnicianUseCase;
  const technician = makeTechnician();

  beforeEach(() => {
    technicianRepo = makeTechnicianRepo();
    useCase = new GetTechnicianUseCase(technicianRepo, makeLogger());

    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the technician as a DTO', async () => {
    const result = await useCase.execute({
      id: technician.id.toString()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.fullName).toBe('Andrés Muñoz');
    expect(result.value.phone).toBe('+573001112233');
  });

  it('fails when the technician does not exist', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician not found');
  });

  it('requires an id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician ID is required');
    expect(technicianRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid technician ID');
  });

  it('propagates a repository failure', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.fail('Database error finding technician')
    );

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
