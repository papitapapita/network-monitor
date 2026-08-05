// Source: src/application/tickets/use-cases/DeleteTechnicianUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { DeleteTechnicianUseCase } from '../../../../src/application/tickets/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTechnicianRepo,
  makeTechnician
} from './mocks';

describe('DeleteTechnicianUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: DeleteTechnicianUseCase;
  const technician = makeTechnician();

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    useCase = new DeleteTechnicianUseCase(
      technicianRepo,
      ticketRepo,
      makeLogger()
    );

    (technicianRepo.exists as any).mockResolvedValue(Result.ok(true));
    (ticketRepo.countByTechnician as any).mockResolvedValue(
      Result.ok(0)
    );
    (technicianRepo.delete as any).mockResolvedValue(Result.ok());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const id = () => technician.id.toString();

  it('deletes a technician with no tickets', async () => {
    const result = await useCase.execute({ id: id() });

    expect(result.isSuccess).toBe(true);
    expect(technicianRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('[TKT-097] refuses when tickets reference the technician', async () => {
    (ticketRepo.countByTechnician as any).mockResolvedValue(
      Result.ok(4)
    );

    const result = await useCase.execute({ id: id() });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Cannot delete a technician');
    expect(result.error).toContain('4 ticket(s)');
    expect(technicianRepo.delete).not.toHaveBeenCalled();
  });

  it('[TKT-097] points the caller at deactivation instead', async () => {
    (ticketRepo.countByTechnician as any).mockResolvedValue(
      Result.ok(1)
    );

    const result = await useCase.execute({ id: id() });

    expect(result.error).toContain('deactivate them instead');
  });

  it('checks existence before counting tickets', async () => {
    (technicianRepo.exists as any).mockResolvedValue(
      Result.ok(false)
    );

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician not found');
    expect(ticketRepo.countByTechnician).not.toHaveBeenCalled();
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

  it('propagates a delete failure', async () => {
    (technicianRepo.delete as any).mockResolvedValue(
      Result.fail('Database error deleting technician')
    );

    const result = await useCase.execute({ id: id() });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
