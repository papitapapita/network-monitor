// Source: src/application/tickets/use-cases/GetTechnicianDayUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetTechnicianDayUseCase } from 'application/tickets/use-cases';
import {
  PrismaTicketRepository,
  PrismaTechnicianRepository
} from 'infrastructure/tickets/repositories';
import {
  CustomerDirectoryAdapter,
  DeviceDirectoryAdapter
} from 'infrastructure/tickets/adapters';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanTickets,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedCustomer,
  seedDevice,
  seedDeviceModel,
  seedTechnician,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

const TODAY = '2026-08-04';
const todayDate = () => new Date(`${TODAY}T00:00:00.000Z`);

describe('GetTechnicianDayUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetTechnicianDayUseCase;
  let technicianId: string;
  let otherTechnicianId: string;
  let customerId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetTechnicianDayUseCase(
      new PrismaTicketRepository(prisma),
      new PrismaTechnicianRepository(prisma),
      new CustomerDirectoryAdapter(prisma),
      new DeviceDirectoryAdapter(prisma),
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
    await cleanCatalog(prisma);

    technicianId = await seedTechnician(prisma, {
      fullName: 'Andrés Muñoz',
      phone: '+573001112233'
    });
    otherTechnicianId = await seedTechnician(prisma, {
      fullName: 'Ana Ruiz',
      phone: '+573004445566'
    });
    customerId = await seedCustomer(prisma, {
      fullName: 'Marta Ríos',
      phone: '3001234567',
      email: 'marta@example.com'
    });
    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE-Marta'
    });
  });

  it('returns the day sheet with contact and device details attached', async () => {
    const ticketId = await seedTicket(prisma, {
      customerId,
      deviceId,
      technicianId,
      status: 'ASSIGNED',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.date).toBe(TODAY);
    expect(result.value.technician.fullName).toBe('Andrés Muñoz');
    expect(result.value.total).toBe(1);

    const ticket = result.value.tickets[0];
    expect(ticket.id).toBe(ticketId);
    expect(ticket.customer).toMatchObject({
      fullName: 'Marta Ríos',
      phone: '3001234567'
    });
    expect(ticket.device).toMatchObject({ name: 'CPE-Marta' });
    expect(ticket.technician!.id).toBe(technicianId);
  });

  it('[TKT-076] orders urgent work first and older work first within a priority', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      priority: 'NORMAL',
      title: 'Normal older',
      scheduledFor: todayDate()
    });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      priority: 'URGENT',
      title: 'Urgent',
      scheduledFor: todayDate()
    });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      priority: 'NORMAL',
      title: 'Normal newer',
      scheduledFor: todayDate()
    });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      priority: 'LOW',
      title: 'Low',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.tickets.map((t) => t.title)).toEqual([
      'Urgent',
      'Normal older',
      'Normal newer',
      'Low'
    ]);
  });

  it('excludes another technician’s work', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId: otherTechnicianId,
      status: 'ASSIGNED',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.total).toBe(0);
  });

  it('excludes the day before and the day after', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      scheduledFor: new Date('2026-08-03T00:00:00.000Z')
    });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      scheduledFor: new Date('2026-08-05T00:00:00.000Z')
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.total).toBe(0);
  });

  it('excludes unscheduled work', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED',
      scheduledFor: null
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.total).toBe(0);
  });

  it('[TKT-009] excludes resolved and cancelled work', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'RESOLVED',
      scheduledFor: todayDate()
    });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'CANCELLED',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.total).toBe(0);
  });

  it('includes work already in progress', async () => {
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'IN_PROGRESS',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.total).toBe(1);
  });

  it('returns an empty day rather than failing when there is nothing to do', async () => {
    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.tickets).toEqual([]);
    expect(result.value.total).toBe(0);
  });

  it('defaults to today when no date is supplied', async () => {
    const result = await useCase.execute({ technicianId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.date).toBe(
      new Date().toISOString().slice(0, 10)
    );
  });

  it('leaves the customer null on a device-only ticket', async () => {
    await seedTicket(prisma, {
      customerId: null,
      deviceId,
      technicianId,
      status: 'ASSIGNED',
      scheduledFor: todayDate()
    });

    const result = await useCase.execute({
      technicianId,
      date: TODAY
    });

    expect(result.value.tickets[0].customer).toBeNull();
    expect(result.value.tickets[0].device).not.toBeNull();
  });

  it('fails when the technician does not exist', async () => {
    const result = await useCase.execute({
      technicianId: GHOST_ID,
      date: TODAY
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed technician id', async () => {
    const result = await useCase.execute({
      technicianId: INVALID_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });

  it('fails on an empty technician id', async () => {
    const result = await useCase.execute({ technicianId: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails on a date that is not a real calendar day', async () => {
    const result = await useCase.execute({
      technicianId,
      date: '2026-02-30'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not a real date/i);
  });

  it('fails on a malformed date', async () => {
    const result = await useCase.execute({
      technicianId,
      date: '04/08/2026'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/YYYY-MM-DD/);
  });
});
