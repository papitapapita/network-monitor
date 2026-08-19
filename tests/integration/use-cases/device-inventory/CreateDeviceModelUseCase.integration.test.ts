// Source: src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceModelUseCase } from 'application/device-inventory/use-cases/CreateDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCatalog,
  seedVendor,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('CreateDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateDeviceModelUseCase;
  let vendorId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const vendorRepo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new CreateDeviceModelUseCase(
      deviceModelRepo,
      vendorRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, {
      name: 'MikroTik',
      slug: 'mikrotik'
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('creates a device model successfully and returns vendorName', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'RB4011iGS+',
      deviceType: 'ROUTERBOARD'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBeDefined();
    expect(result.value.vendorId).toBe(vendorId);
    expect(result.value.vendorName).toBe('MikroTik');
    expect(result.value.model).toBe('RB4011iGS+');
    expect(result.value.deviceType).toBe('ROUTERBOARD');
  });

  it('[DEV-028] reports the vendor name and slug of the row it linked to', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'hEX S',
      deviceType: 'ROUTER'
    });

    expect(result.value.vendorSlug).toBe('mikrotik');

    const row = await prisma.deviceModel.findUnique({
      where: { id: result.value.id },
      include: { vendor: true }
    });
    expect(row!.vendor.name).toBe('MikroTik');
  });

  // ──────────────────────────────────────────────────────────────
  // DEV-025 — wireless flag
  // ──────────────────────────────────────────────────────────────

  it('[DEV-025] stores isWireless false when the flag is omitted', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'CRS310',
      deviceType: 'SWITCH'
    });

    expect(result.value.isWireless).toBe(false);

    const row = await prisma.deviceModel.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.isWireless).toBe(false);
  });

  it('[DEV-025] stores isWireless true when the flag is set', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'LHG 5',
      deviceType: 'ANTENNA',
      isWireless: true
    });

    expect(result.value.isWireless).toBe(true);

    const row = await prisma.deviceModel.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.isWireless).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Duplicate
  // ──────────────────────────────────────────────────────────────

  it('[DEV-022] fails when the same vendorId and model already exist', async () => {
    await useCase.execute({
      vendorId,
      model: 'hAP ac3',
      deviceType: 'ROUTER'
    });

    const second = await useCase.execute({
      vendorId,
      model: 'hAP ac3',
      deviceType: 'ROUTER'
    });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/already exists/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when vendorId is not a valid UUID', async () => {
    const result = await useCase.execute({
      vendorId: INVALID_ID,
      model: 'SomeModel',
      deviceType: 'ROUTER'
    });

    expect(result.isFailure).toBe(true);
  });

  it('[DEV-021] fails when the vendor does not exist (GHOST_ID as vendorId)', async () => {
    const result = await useCase.execute({
      vendorId: GHOST_ID,
      model: 'GhostModel',
      deviceType: 'SWITCH'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // These bypass the Zod schema entirely — the rule has to hold at the use case
  // too, or a non-HTTP caller could write a row the API would have rejected.

  it('[DEV-020] fails when vendorId, model or deviceType is missing', async () => {
    const bodies = [
      { model: 'NoVendor', deviceType: 'ROUTER' },
      { vendorId, deviceType: 'ROUTER' },
      { vendorId, model: 'NoType' }
    ];

    for (const body of bodies) {
      const result = await useCase.execute(body as any);

      expect(result.isFailure).toBe(true);
    }

    await expect(prisma.deviceModel.count()).resolves.toBe(0);
  });

  it('[DEV-023] fails when the model name is empty or whitespace only', async () => {
    for (const model of ['', '   ']) {
      const result = await useCase.execute({
        vendorId,
        model,
        deviceType: 'ROUTER'
      });

      expect(result.isFailure).toBe(true);
    }

    await expect(prisma.deviceModel.count()).resolves.toBe(0);
  });

  it('[DEV-023] fails when the model name exceeds 150 characters', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'A'.repeat(151),
      deviceType: 'ROUTER'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/150/);
  });

  it('[DEV-023] accepts a model name of exactly 150 characters', async () => {
    const model = 'A'.repeat(150);

    const result = await useCase.execute({
      vendorId,
      model,
      deviceType: 'ROUTER'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.deviceModel.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.model).toHaveLength(150);
  });

  it('[DEV-024] fails when the deviceType is not one of the seven values', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'Mystery Box',
      deviceType: 'TOASTER' as any
    });

    expect(result.isFailure).toBe(true);
    await expect(prisma.deviceModel.count()).resolves.toBe(0);
  });
});
