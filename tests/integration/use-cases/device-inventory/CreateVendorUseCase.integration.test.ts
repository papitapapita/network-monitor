// Source: src/application/device-inventory/use-cases/CreateVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateVendorUseCase } from 'application/device-inventory/use-cases/CreateVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog } from '../../helpers/db';

describe('CreateVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateVendorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new CreateVendorUseCase(repo, logger);
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

  it('creates a vendor successfully and returns id, name, and slug', async () => {
    const result = await useCase.execute({
      name: 'Ubiquiti',
      slug: 'ubiquiti'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBeDefined();
    expect(result.value.name).toBe('Ubiquiti');
    expect(result.value.slug).toBe('ubiquiti');
    expect(result.value.description).toBeNull();
  });

  it('creates a vendor with an optional description', async () => {
    const result = await useCase.execute({
      name: 'TP-Link',
      slug: 'tp-link',
      description: 'Networking equipment manufacturer'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.description).toBe(
      'Networking equipment manufacturer'
    );
  });

  it('persists the vendor in the database', async () => {
    const result = await useCase.execute({
      name: 'Cisco',
      slug: 'cisco'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.vendor.findUnique({
      where: { id: result.value.id }
    });
    expect(row).not.toBeNull();
    expect(row!.name).toBe('Cisco');
    expect(row!.slug).toBe('cisco');
  });

  // ──────────────────────────────────────────────────────────────
  // Duplicate slug
  // ──────────────────────────────────────────────────────────────

  it('[DEV-003] fails with isFailure=true when slug already exists', async () => {
    await useCase.execute({
      name: 'First Vendor',
      slug: 'duplicate-slug'
    });

    const second = await useCase.execute({
      name: 'Second Vendor',
      slug: 'duplicate-slug'
    });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/already exists/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-001] fails with isFailure=true when name is empty', async () => {
    const result = await useCase.execute({
      name: '',
      slug: 'valid-slug'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/name/i);
  });

  it('[DEV-002] fails with isFailure=true when slug is empty', async () => {
    const result = await useCase.execute({
      name: 'Valid Name',
      slug: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/slug/i);
  });

  it('[DEV-001] fails when the name exceeds 100 characters', async () => {
    const result = await useCase.execute({
      name: 'A'.repeat(101),
      slug: 'long-name'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/100/);
    await expect(prisma.vendor.count()).resolves.toBe(0);
  });

  it('[DEV-001] accepts a name of exactly 100 characters', async () => {
    const result = await useCase.execute({
      name: 'A'.repeat(100),
      slug: 'hundred-char-name'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.vendor.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.name).toHaveLength(100);
  });

  it('[DEV-002] fails when the slug is not lowercase letters, digits and hyphens', async () => {
    for (const slug of ['Bad-Slug', 'bad slug', 'bad_slug']) {
      const result = await useCase.execute({
        name: 'Valid Name',
        slug
      });

      expect(result.isFailure).toBe(true);
    }

    await expect(prisma.vendor.count()).resolves.toBe(0);
  });

  it('[DEV-004] fails when the description exceeds 500 characters', async () => {
    const result = await useCase.execute({
      name: 'Verbose',
      slug: 'verbose',
      description: 'D'.repeat(501)
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/500/);
    await expect(prisma.vendor.count()).resolves.toBe(0);
  });

  it('[DEV-004] accepts a description of exactly 500 characters', async () => {
    const result = await useCase.execute({
      name: 'Verbose',
      slug: 'verbose',
      description: 'D'.repeat(500)
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.vendor.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.description).toHaveLength(500);
  });

  it('[DEV-006] fails when name or slug is missing entirely', async () => {
    const bodies = [{ slug: 'no-name' }, { name: 'No Slug' }, {}];

    for (const body of bodies) {
      const result = await useCase.execute(body as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/required/i);
    }

    await expect(prisma.vendor.count()).resolves.toBe(0);
  });
});
