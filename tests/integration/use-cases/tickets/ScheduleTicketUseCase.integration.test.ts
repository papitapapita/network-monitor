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
  seedTechnician,
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

  it('stores a time block as HH:mm columns on the scheduled day', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-01',
      startTime: '09:00',
      endTime: '10:30'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.startTime).toBe('09:00');
    expect(result.value.endTime).toBe('10:30');

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledStartTime).toBe('09:00');
    expect(row!.scheduledEndTime).toBe('10:30');
  });

  it('[TKT-081] clears the stored block when rescheduled without one', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-09-01T00:00:00.000Z'),
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:30'
    });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-02'
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledStartTime).toBeNull();
    expect(row!.scheduledEndTime).toBeNull();
  });

  it('[TKT-080] refuses half a block and leaves the row untouched', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      scheduledFor: '2026-09-01',
      startTime: '09:00'
    });

    expect(result.isFailure).toBe(true);
    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.scheduledFor).toBeNull();
  });

  it('[TKT-079] the database refuses a block with no scheduled day', async () => {
    const id = await seedTicket(prisma, { customerId });

    await expect(
      prisma.ticket.update({
        where: { id },
        data: {
          scheduledStartTime: '09:00',
          scheduledEndTime: '10:00'
        }
      })
    ).rejects.toThrow();
  });

  it('[TKT-078] the database refuses a block that ends before it starts', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-09-01T00:00:00.000Z')
    });

    await expect(
      prisma.ticket.update({
        where: { id },
        data: {
          scheduledStartTime: '10:00',
          scheduledEndTime: '09:00'
        }
      })
    ).rejects.toThrow();
  });

  it('[TKT-082] books overlapping blocks for the same technician', async () => {
    const technicianId = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    const first = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });
    const second = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const a = await useCase.execute({
      id: first,
      scheduledFor: '2026-09-01',
      startTime: '09:00',
      endTime: '11:00'
    });
    const b = await useCase.execute({
      id: second,
      scheduledFor: '2026-09-01',
      startTime: '10:00',
      endTime: '12:00'
    });

    expect(a.isSuccess).toBe(true);
    expect(b.isSuccess).toBe(true);
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
