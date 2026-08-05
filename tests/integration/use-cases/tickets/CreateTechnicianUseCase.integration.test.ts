// Source: src/application/tickets/use-cases/CreateTechnicianUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateTechnicianUseCase } from 'application/tickets/use-cases';
import { PrismaTechnicianRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanTickets, seedTechnician } from '../../helpers/db';

describe('CreateTechnicianUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateTechnicianUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new CreateTechnicianUseCase(
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

  it('[TKT-094] writes an active technician', async () => {
    const result = await useCase.execute({
      fullName: 'Andrés Muñoz',
      phone: '+573001112233'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(true);

    const row = await prisma.technician.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.fullName).toBe('Andrés Muñoz');
    expect(row!.phone).toBe('+573001112233');
  });

  it('normalizes the phone number before storing it', async () => {
    const result = await useCase.execute({
      fullName: 'Ana Ruiz',
      phone: '+57 (300) 444-5566'
    });

    expect(result.value.phone).toBe('+573004445566');
  });

  it('normalizes the email to lowercase', async () => {
    const result = await useCase.execute({
      fullName: 'Ana Ruiz',
      phone: '+573004445566',
      email: 'Ana@ISP.Example'
    });

    expect(result.value.email).toBe('ana@isp.example');
  });

  it('[TKT-095] refuses a phone another technician already has', async () => {
    await seedTechnician(prisma, { phone: '+573001112233' });

    const result = await useCase.execute({
      fullName: 'Duplicate',
      phone: '+573001112233'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
    expect(await prisma.technician.count()).toBe(1);
  });

  it('[TKT-095] treats differently formatted phones as the same number', async () => {
    await useCase.execute({
      fullName: 'First',
      phone: '+573001112233'
    });

    const result = await useCase.execute({
      fullName: 'Second',
      phone: '+57 300 111 2233'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  it('[TKT-096] refuses an email another technician already has', async () => {
    await useCase.execute({
      fullName: 'First',
      phone: '+573001112233',
      email: 'shared@isp.example'
    });

    const result = await useCase.execute({
      fullName: 'Second',
      phone: '+573004445566',
      email: 'shared@isp.example'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/email .* already exists/i);
  });

  it('[TKT-096] allows any number of technicians with no email', async () => {
    await useCase.execute({
      fullName: 'First',
      phone: '+573001112233'
    });

    const result = await useCase.execute({
      fullName: 'Second',
      phone: '+573004445566'
    });

    expect(result.isSuccess).toBe(true);
    expect(await prisma.technician.count()).toBe(2);
  });

  it('[TKT-090] fails on a blank name', async () => {
    const result = await useCase.execute({
      fullName: '   ',
      phone: '+573001112233'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/name is required/i);
  });

  it('[TKT-092] fails on a missing phone', async () => {
    const result = await useCase.execute({
      fullName: 'No Phone',
      phone: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/phone is required/i);
  });

  it('[TKT-093] fails on a malformed email', async () => {
    const result = await useCase.execute({
      fullName: 'Bad Email',
      phone: '+573001112233',
      email: 'not-an-email'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/valid email/i);
  });

  it('fails on a phone with too few digits', async () => {
    const result = await useCase.execute({
      fullName: 'Short',
      phone: '12345'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/at least 7 digits/i);
  });
});
