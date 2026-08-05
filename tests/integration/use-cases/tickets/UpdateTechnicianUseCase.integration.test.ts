// Source: src/application/tickets/use-cases/UpdateTechnicianUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateTechnicianUseCase } from 'application/tickets/use-cases';
import { PrismaTechnicianRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanTickets,
  seedTechnician,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateTechnicianUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateTechnicianUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new UpdateTechnicianUseCase(
      new PrismaTechnicianRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanTickets(prisma);
  });

  it('renames a technician through to the row', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    const result = await useCase.execute({
      id,
      fullName: 'Renamed Tech'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.technician.findUnique({ where: { id } });
    expect(row!.fullName).toBe('Renamed Tech');
  });

  it('deactivates and reactivates', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    await useCase.execute({ id, isActive: false });
    expect(
      (await prisma.technician.findUnique({ where: { id } }))!
        .isActive
    ).toBe(false);

    await useCase.execute({ id, isActive: true });
    expect(
      (await prisma.technician.findUnique({ where: { id } }))!
        .isActive
    ).toBe(true);
  });

  it('[TKT-095] allows a technician to keep their own phone number', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    const result = await useCase.execute({
      id,
      phone: '+573001112233',
      fullName: 'Same Phone'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('[TKT-095] refuses a phone owned by a different technician', async () => {
    await seedTechnician(prisma, { phone: '+573001112233' });
    const id = await seedTechnician(prisma, {
      phone: '+573004445566'
    });

    const result = await useCase.execute({
      id,
      phone: '+573001112233'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);

    const row = await prisma.technician.findUnique({ where: { id } });
    expect(row!.phone).toBe('+573004445566');
  });

  it('[TKT-096] refuses an email owned by a different technician', async () => {
    await seedTechnician(prisma, {
      phone: '+573001112233',
      email: 'taken@isp.example'
    });
    const id = await seedTechnician(prisma, {
      phone: '+573004445566'
    });

    const result = await useCase.execute({
      id,
      email: 'taken@isp.example'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  it('clears the email when null is supplied', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233',
      email: 'clearme@isp.example'
    });

    await useCase.execute({ id, email: null });

    const row = await prisma.technician.findUnique({ where: { id } });
    expect(row!.email).toBeNull();
  });

  it('[TKT-093] fails on a malformed email', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    const result = await useCase.execute({ id, email: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/valid email/i);
  });

  it('[TKT-090] fails on a blank name', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573001112233'
    });

    const result = await useCase.execute({ id, fullName: '   ' });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the technician does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      fullName: 'Ghost'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      fullName: 'Bad'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });
});
