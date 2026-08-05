// Source: src/application/tickets/use-cases/StartTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { StartTicketUseCase } from 'application/tickets/use-cases';
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

describe('StartTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: StartTicketUseCase;
  let technicianId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new StartTicketUseCase(
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

  it('moves an assigned ticket to IN_PROGRESS and stamps startedAt', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('IN_PROGRESS');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('IN_PROGRESS');
    expect(row!.startedAt).not.toBeNull();
  });

  it('[TKT-040] refuses to start an unassigned ticket', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Only an assigned ticket/i);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('OPEN');
  });

  it('[TKT-041] refuses to start a ticket twice', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS'
    });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already in progress/i);
  });

  it('[TKT-009] refuses to start a resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/resolved/i);
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });

  it('fails on an empty id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
