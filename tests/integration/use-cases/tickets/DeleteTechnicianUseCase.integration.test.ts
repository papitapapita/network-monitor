// Source: src/application/tickets/use-cases/DeleteTechnicianUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteTechnicianUseCase } from 'application/tickets/use-cases';
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

describe('DeleteTechnicianUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteTechnicianUseCase;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new DeleteTechnicianUseCase(
      new PrismaTechnicianRepository(prisma),
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

  it('removes a technician who has never been given work', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(
      await prisma.technician.findUnique({ where: { id } })
    ).toBeNull();
  });

  it('[TKT-097] refuses while an open ticket references them', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    await seedTicket(prisma, {
      customerId,
      technicianId: id,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot delete a technician/i);
    expect(result.error).toMatch(/deactivate them instead/i);
  });

  it('[TKT-097] refuses even when every ticket is already closed', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    await seedTicket(prisma, {
      customerId,
      technicianId: id,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
  });

  it('[TKT-097] leaves the technician and their tickets untouched after a refusal', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
    const ticketId = await seedTicket(prisma, {
      customerId,
      technicianId: id,
      status: 'ASSIGNED'
    });

    await useCase.execute({ id });

    expect(
      await prisma.technician.findUnique({ where: { id } })
    ).not.toBeNull();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    expect(ticket!.technicianId).toBe(id);
  });

  it('fails when the technician does not exist', async () => {
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
