// Source: src/application/tickets/use-cases/UpdateTechnicianUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateTechnicianUseCase } from '../../../../src/application/tickets/use-cases';
import { Technician } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTechnicianRepo,
  makeTechnician
} from './mocks';

describe('UpdateTechnicianUseCase', () => {
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: UpdateTechnicianUseCase;
  let technician: Technician;

  beforeEach(() => {
    technicianRepo = makeTechnicianRepo();
    useCase = new UpdateTechnicianUseCase(
      technicianRepo,
      makeLogger()
    );

    technician = makeTechnician();

    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );
    (technicianRepo.findByPhone as any).mockResolvedValue(
      Result.ok(null)
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

  const id = () => technician.id.toString();

  it('renames the technician', async () => {
    const result = await useCase.execute({
      id: id(),
      fullName: 'Renamed'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.fullName).toBe('Renamed');
  });

  it('deactivates when isActive is false', async () => {
    const result = await useCase.execute({
      id: id(),
      isActive: false
    });

    expect(result.value.isActive).toBe(false);
  });

  it('reactivates when isActive is true', async () => {
    technician.deactivate();

    const result = await useCase.execute({
      id: id(),
      isActive: true
    });

    expect(result.value.isActive).toBe(true);
  });

  it('[TKT-095] skips the uniqueness check when the phone is unchanged', async () => {
    await useCase.execute({ id: id(), phone: '+573001112233' });

    expect(technicianRepo.findByPhone).not.toHaveBeenCalled();
  });

  it('[TKT-095] rejects a phone another technician owns', async () => {
    (technicianRepo.findByPhone as any).mockResolvedValue(
      Result.ok(makeTechnician())
    );

    const result = await useCase.execute({
      id: id(),
      phone: '+573009998877'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('[TKT-096] rejects an email another technician owns', async () => {
    (technicianRepo.existsByEmail as any).mockResolvedValue(
      Result.ok(true)
    );

    const result = await useCase.execute({
      id: id(),
      email: 'taken@isp.example'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
  });

  it('clears the email without a uniqueness check', async () => {
    const result = await useCase.execute({ id: id(), email: null });

    expect(result.isSuccess).toBe(true);
    expect(result.value.email).toBeNull();
    expect(technicianRepo.existsByEmail).not.toHaveBeenCalled();
  });

  it('unlinks the user account when null is supplied', async () => {
    const result = await useCase.execute({ id: id(), userId: null });

    expect(result.isSuccess).toBe(true);
    expect(result.value.userId).toBeNull();
  });

  it('rejects a malformed user id', async () => {
    const result = await useCase.execute({
      id: id(),
      userId: 'nope'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid user ID');
  });

  it('fails when the technician does not exist', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute({
      id: GHOST_ID,
      fullName: 'Ghost'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician not found');
  });

  it('requires an id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician ID is required');
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid technician ID');
  });

  it('propagates a persistence failure', async () => {
    (technicianRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving technician')
    );

    const result = await useCase.execute({
      id: id(),
      fullName: 'Renamed'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist technician');
  });
});
