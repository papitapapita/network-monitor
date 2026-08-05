// Source: src/application/tickets/use-cases/CancelTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CancelTicketUseCase } from 'application/tickets/use-cases';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanTickets,
  cleanBills,
  cleanCustomers,
  seedCustomer,
  seedTechnician,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('CancelTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CancelTicketUseCase;
  let technicianId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new CancelTicketUseCase(
      new PrismaTicketRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanTickets(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);

    technicianId = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
  });

  it('cancels an open ticket and stores the reason', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      reason: 'Duplicate of ticket #12'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('CANCELLED');
    expect(row!.cancelReason).toBe('Duplicate of ticket #12');
    expect(row!.cancelledAt).not.toBeNull();
  });

  it('cancels a ticket that is already in progress', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS'
    });

    const result = await useCase.execute({
      id,
      reason: 'Customer not home'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('[TKT-044] refuses a blank reason', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id, reason: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/reason is required/i);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('OPEN');
  });

  it('[TKT-044] refuses a reason longer than 255 characters', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      reason: 'x'.repeat(256)
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cannot exceed 255/i);
  });

  it('[TKT-045] refuses to cancel a resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id, reason: 'Too late' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot cancel a resolved ticket/i);
  });

  it('[TKT-046] refuses to cancel a ticket twice', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      status: 'CANCELLED'
    });

    const result = await useCase.execute({ id, reason: 'Again' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already cancelled/i);
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      reason: 'Gone'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      reason: 'Bad'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });
});
