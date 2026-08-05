// Source: src/application/tickets/use-cases/AssignTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AssignTicketUseCase } from 'application/tickets/use-cases';
import {
  PrismaTicketRepository,
  PrismaTechnicianRepository
} from 'infrastructure/tickets/repositories';
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

describe('AssignTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AssignTicketUseCase;
  let technicianId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new AssignTicketUseCase(
      new PrismaTicketRepository(prisma),
      new PrismaTechnicianRepository(prisma),
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

  it('[TKT-070] assigns the ticket and writes the row through', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id, technicianId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ASSIGNED');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.technicianId).toBe(technicianId);
    expect(row!.status).toBe('ASSIGNED');
    expect(row!.assignedAt).not.toBeNull();
  });

  it('stores the schedule date as a calendar day', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      technicianId,
      scheduledFor: '2026-08-04'
    });

    expect(result.value.scheduledFor).toBe('2026-08-04');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledFor!.toISOString().slice(0, 10)).toBe(
      '2026-08-04'
    );
  });

  it('[TKT-071] reassigns a ticket that has not been started', async () => {
    const otherId = await seedTechnician(prisma, {
      phone: '+573004445566'
    });
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({
      id,
      technicianId: otherId
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.technicianId).toBe(otherId);
  });

  it('[TKT-072] refuses to reassign a ticket in progress', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS'
    });

    const result = await useCase.execute({ id, technicianId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already in progress/i);
  });

  it('[TKT-073] refuses to assign a resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id, technicianId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/resolved/i);
  });

  it('[TKT-077] refuses an inactive technician and leaves the ticket untouched', async () => {
    const inactiveId = await seedTechnician(prisma, {
      phone: '+573009990000',
      isActive: false
    });
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      technicianId: inactiveId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/inactive technician/i);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.technicianId).toBeNull();
    expect(row!.status).toBe('OPEN');
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      technicianId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Ticket not found/i);
  });

  it('fails when the technician does not exist', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      technicianId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Technician not found/i);
  });

  it('fails on a malformed ticket id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      technicianId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });

  it('fails on an empty ticket id', async () => {
    const result = await useCase.execute({ id: '  ', technicianId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails on a malformed schedule date', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      technicianId,
      scheduledFor: 'tomorrow'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/YYYY-MM-DD/);
  });
});
