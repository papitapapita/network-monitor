// Source: src/application/tickets/use-cases/DeleteTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteTicketUseCase } from 'application/tickets/use-cases';
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

describe('DeleteTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteTicketUseCase;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new DeleteTicketUseCase(
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

  it('removes the row', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(
      await prisma.ticket.findUnique({ where: { id } })
    ).toBeNull();
  });

  it('deletes a resolved ticket, since deletion is for mistakes not lifecycle', async () => {
    const technicianId = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    const id = await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  it('leaves the customer intact', async () => {
    const id = await seedTicket(prisma, { customerId });

    await useCase.execute({ id });

    expect(
      await prisma.customer.findUnique({ where: { id: customerId } })
    ).not.toBeNull();
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
