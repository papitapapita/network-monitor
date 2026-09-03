// Source: src/application/device-inventory/use-cases/UpdateVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateVendorUseCase } from 'application/device-inventory/use-cases/UpdateVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { DeviceModelId } from 'domain/shared/ids';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID } from '../../helpers/db';

describe('UpdateVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateVendorUseCase;
  let deviceModelRepository: PrismaDeviceModelRepository;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new UpdateVendorUseCase(repo, logger);
    deviceModelRepository = new PrismaDeviceModelRepository(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the vendor name only, leaving slug unchanged', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Old Name',
      slug: 'old-name'
    });

    const result = await useCase.execute({
      id: vendorId,
      name: 'New Name'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('New Name');
    expect(result.value.slug).toBe('old-name');
  });

  it('updates the vendor slug only, leaving name unchanged', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Stable Name',
      slug: 'old-slug'
    });

    const result = await useCase.execute({
      id: vendorId,
      slug: 'new-slug'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.slug).toBe('new-slug');
    expect(result.value.name).toBe('Stable Name');
  });

  it('updates description to null', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Has Desc',
      slug: 'has-desc',
      description: 'Old description'
    });

    const result = await useCase.execute({
      id: vendorId,
      description: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.description).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // DEV-028 — the vendor name and slug device models carry
  // ──────────────────────────────────────────────────────────────

  it('[DEV-028] a rename reaches device models already pointing at the vendor', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Old Name',
      slug: 'old-slug'
    });
    const row = await prisma.deviceModel.create({
      data: { vendorId, model: 'NanoBeam 5AC', deviceType: 'ANTENNA' }
    });

    const result = await useCase.execute({
      id: vendorId,
      name: 'New Name',
      slug: 'new-slug'
    });
    expect(result.isSuccess).toBe(true);

    const reloaded = await deviceModelRepository.findById(
      DeviceModelId.parse(row.id).value
    );

    expect(reloaded.value!.vendorName).toBe('New Name');
    expect(reloaded.value!.vendorSlug).toBe('new-slug');
  });

  // ──────────────────────────────────────────────────────────────
  // Slug conflict
  // ──────────────────────────────────────────────────────────────

  it('[DEV-003] fails when the new slug is already taken by another vendor', async () => {
    await seedVendor(prisma, { name: 'Alpha', slug: 'alpha-vendor' });
    const betaId = await seedVendor(prisma, {
      name: 'Beta',
      slug: 'beta-vendor'
    });

    const result = await useCase.execute({
      id: betaId,
      slug: 'alpha-vendor'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Name conflict
  // ──────────────────────────────────────────────────────────────

  it('[DEV-007] fails when the new name is already taken by another vendor', async () => {
    await seedVendor(prisma, { name: 'Mimosa', slug: 'mimosa' });
    const betaId = await seedVendor(prisma, {
      name: 'Beta',
      slug: 'beta-vendor'
    });

    const result = await useCase.execute({
      id: betaId,
      name: 'Mimosa'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  it('[DEV-007] fails when the new name differs only in case from another vendor', async () => {
    await seedVendor(prisma, { name: 'Mimosa', slug: 'mimosa' });
    const betaId = await seedVendor(prisma, {
      name: 'Beta',
      slug: 'beta-vendor'
    });

    const result = await useCase.execute({
      id: betaId,
      name: 'mimosa'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  it('[DEV-007] succeeds when a vendor "renames" itself to a different case of its own name', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Mimosa',
      slug: 'mimosa'
    });

    const result = await useCase.execute({
      id: vendorId,
      name: 'mimosa'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('mimosa');
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the vendor does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      name: 'Ghost'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // The create-path rules must hold on update too
  // ──────────────────────────────────────────────────────────────

  it('[DEV-001] fails when the new name is empty or exceeds 100 characters', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Keep Me',
      slug: 'keep-me'
    });

    for (const name of ['', '   ', 'A'.repeat(101)]) {
      const result = await useCase.execute({ id: vendorId, name });

      expect(result.isFailure).toBe(true);
    }

    const row = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });
    expect(row!.name).toBe('Keep Me');
  });

  it('[DEV-002] fails when the new slug is not lowercase letters, digits and hyphens', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Keep Me',
      slug: 'keep-me'
    });

    for (const slug of ['Bad-Slug', 'bad slug', 'bad_slug']) {
      const result = await useCase.execute({ id: vendorId, slug });

      expect(result.isFailure).toBe(true);
    }

    const row = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });
    expect(row!.slug).toBe('keep-me');
  });

  it('[DEV-004] fails when the new description exceeds 500 characters', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Keep Me',
      slug: 'keep-me',
      description: 'Original'
    });

    const result = await useCase.execute({
      id: vendorId,
      description: 'D'.repeat(501)
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/500/);

    const row = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });
    expect(row!.description).toBe('Original');
  });
});
