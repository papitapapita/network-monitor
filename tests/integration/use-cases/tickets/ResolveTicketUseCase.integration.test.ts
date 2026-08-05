// Source: src/application/tickets/use-cases/ResolveTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ResolveTicketUseCase } from 'application/tickets/use-cases';
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

describe('ResolveTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ResolveTicketUseCase;
  let technicianId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new ResolveTicketUseCase(
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

  it('resolves an in-progress ticket and stores the notes', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS'
    });

    const result = await useCase.execute({
      id,
      resolutionNotes:
        'Realigned the antenna and re-crimped the LAN drop'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('RESOLVED');
    expect(row!.resolutionNotes).toBe(
      'Realigned the antenna and re-crimped the LAN drop'
    );
    expect(row!.resolvedAt).not.toBeNull();
  });

  it('resolves straight from ASSIGNED for a fault fixed remotely', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({
      id,
      resolutionNotes: 'Rebooted the CPE remotely'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('[TKT-042] refuses to resolve a ticket that was never assigned', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      resolutionNotes: 'Fixed'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/has not been assigned/i);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.status).toBe('OPEN');
  });

  it('[TKT-043] refuses blank resolution notes', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS'
    });

    const result = await useCase.execute({
      id,
      resolutionNotes: '   '
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Resolution notes are required/i);
  });

  it('[TKT-009] refuses to resolve an already resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({
      id,
      resolutionNotes: 'Again'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/resolved/i);
  });

  it('[TKT-010] refuses to resolve a cancelled ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'CANCELLED'
    });

    const result = await useCase.execute({
      id,
      resolutionNotes: 'Fixed anyway'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cancelled/i);
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      resolutionNotes: 'Done'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      resolutionNotes: 'Done'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });
});
