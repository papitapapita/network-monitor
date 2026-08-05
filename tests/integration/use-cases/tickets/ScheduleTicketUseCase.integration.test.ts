// Source: src/application/tickets/use-cases/ScheduleTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ScheduleTicketUseCase } from 'application/tickets/use-cases';
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
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('ScheduleTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ScheduleTicketUseCase;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new ScheduleTicketUseCase(
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
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
  });

  it('stores the visit as a calendar day with no time component', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-01'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.scheduledFor).toBe('2026-09-01');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledFor!.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z'
    );
  });

  it('[TKT-075] accepts a date in the past', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      scheduledFor: '2020-01-01'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('clears the schedule when null is supplied', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-09-01T00:00:00.000Z')
    });

    const result = await useCase.execute({ id, scheduledFor: null });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledFor).toBeNull();
  });

  it('[TKT-074] refuses to reschedule a resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/resolved/i);
  });

  it('[TKT-074] refuses to reschedule a cancelled ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      status: 'CANCELLED'
    });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cancelled/i);
  });

  it('fails on a date that is not a real calendar day', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-02-30'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not a real date/i);
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });
});
