// Source: src/application/tickets/use-cases/CreateTechnicianUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateTechnicianUseCase } from '../../../../src/application/tickets/use-cases';
import { Technician } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { makeLogger, makeTechnicianRepo } from './mocks';

describe('CreateTechnicianUseCase', () => {
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: CreateTechnicianUseCase;

  const validRequest = {
    fullName: 'Andrés Muñoz',
    phone: '+573001112233'
  };

  beforeEach(() => {
    technicianRepo = makeTechnicianRepo();
    useCase = new CreateTechnicianUseCase(
      technicianRepo,
      makeLogger()
    );

    (technicianRepo.existsByPhone as any).mockResolvedValue(
      Result.ok(false)
    );
    (technicianRepo.existsByEmail as any).mockResolvedValue(
      Result.ok(false)
    );
    (technicianRepo.save as any).mockImplementation(
      async (t: Technician) => Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('[TKT-094] creates an active technician', async () => {
    const result = await useCase.execute(validRequest);

    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(true);
  });

  it('normalizes the phone before the uniqueness check', async () => {
    await useCase.execute({
      ...validRequest,
      phone: '+57 (300) 111-2233'
    });

    expect(technicianRepo.existsByPhone).toHaveBeenCalledWith(
      '+573001112233'
    );
  });

  it('normalizes the email to lowercase', async () => {
    const result = await useCase.execute({
      ...validRequest,
      email: 'Andres@ISP.Example'
    });

    expect(result.value.email).toBe('andres@isp.example');
  });

  it('[TKT-095] rejects a duplicate phone and never saves', async () => {
    (technicianRepo.existsByPhone as any).mockResolvedValue(
      Result.ok(true)
    );

    const result = await useCase.execute(validRequest);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
    expect(technicianRepo.save).not.toHaveBeenCalled();
  });

  it('[TKT-096] rejects a duplicate email', async () => {
    (technicianRepo.existsByEmail as any).mockResolvedValue(
      Result.ok(true)
    );

    const result = await useCase.execute({
      ...validRequest,
      email: 'taken@isp.example'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('[TKT-096] skips the email check when none is supplied', async () => {
    await useCase.execute(validRequest);

    expect(technicianRepo.existsByEmail).not.toHaveBeenCalled();
  });

  it('[TKT-090] requires a name', async () => {
    const result = await useCase.execute({
      ...validRequest,
      fullName: '   '
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('name is required');
  });

  it('[TKT-092] requires a phone', async () => {
    const result = await useCase.execute({
      ...validRequest,
      phone: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('phone is required');
  });

  it('rejects a phone with too few digits', async () => {
    const result = await useCase.execute({
      ...validRequest,
      phone: '12345'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('at least 7 digits');
  });

  it('[TKT-093] rejects a malformed email', async () => {
    const result = await useCase.execute({
      ...validRequest,
      email: 'nope'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('valid email');
  });

  it('rejects a malformed user id', async () => {
    const result = await useCase.execute({
      ...validRequest,
      userId: 'not-a-uuid'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid user ID');
  });

  it('propagates a persistence failure', async () => {
    (technicianRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving technician')
    );

    const result = await useCase.execute(validRequest);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist technician');
  });
});
