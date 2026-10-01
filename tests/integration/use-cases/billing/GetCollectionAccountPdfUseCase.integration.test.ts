// Source: src/application/billing/use-cases/GetCollectionAccountPdfUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetCollectionAccountPdfUseCase } from 'application/billing/use-cases';
import { PrismaCollectionAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { SettingsIssuerPdfRenderer } from 'infrastructure/billing/services';
import { loadIssuerDisplayConfig } from 'infrastructure/billing/config/collectionAccountIssuerConfig';
import { PrismaVendorSettingsRepository } from 'infrastructure/persistence/PrismaVendorSettingsRepository';
import { loadVendorSettingsDefaults } from 'infrastructure/di/vendorSettingsDefaults';
import { ISSUER_NOT_CONFIGURED } from 'application/billing/interfaces';
import {
  cleanCollectionAccounts,
  seedCollectionAccount,
  GHOST_ID
} from '../../helpers/db';

describe('GetCollectionAccountPdfUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetCollectionAccountPdfUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new GetCollectionAccountPdfUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new SettingsIssuerPdfRenderer(
        new PrismaVendorSettingsRepository(
          prisma,
          loadVendorSettingsDefaults(process.env)
        ),
        loadIssuerDisplayConfig(process.env)
      ),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
    // The issuer must come from the env defaults, not a row left by another
    // suite (BIL-232).
    await prisma.vendorSettings.deleteMany();
  });

  it('[BIL-230] renders a PDF named after the stored sequence number', async () => {
    const id = await seedCollectionAccount(prisma);
    const { code } = await prisma.collectionAccount.findUniqueOrThrow(
      {
        where: { id }
      }
    );

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.content.subarray(0, 4).toString()).toBe(
      '%PDF'
    );
    expect(result.value.fileName).toBe(
      `cuenta-de-cobro-CC-${String(code).padStart(4, '0')}.pdf`
    );
  });

  it('[BIL-231] renders a cancelled account', async () => {
    const id = await seedCollectionAccount(prisma, {
      status: 'CANCELLED'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  it('[BIL-232] is refused while no issuer is set, and renders once the vendor saves one', async () => {
    const id = await seedCollectionAccount(prisma);
    const noIssuer = new GetCollectionAccountPdfUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new SettingsIssuerPdfRenderer(
        new PrismaVendorSettingsRepository(
          prisma,
          loadVendorSettingsDefaults({})
        ),
        loadIssuerDisplayConfig({})
      ),
      new WinstonLogger()
    );

    const refused = await noIssuer.execute({ id });
    await prisma.vendorSettings.create({
      data: {
        id: 1,
        subscriptionGraceDays: 3,
        subscriptionReadOnlyDays: 7,
        pingResultRetentionDays: 30,
        alertRetentionDays: 90,
        wirelessSnapshotRetentionDays: 30,
        wirelessAlertRecordRetentionDays: 90,
        issuerName: 'Otro ISP',
        issuerDocumentLabel: 'NIT',
        issuerDocument: '900123456-7',
        issuerAddress: 'Calle 1 # 2-3',
        issuerCity: 'Granada',
        issuerContactPhone: '300 000 0000',
        issuerContactEmail: 'cobros@otro.example',
        issuerAccentColorHex: '#336699'
      }
    });
    const rendered = await noIssuer.execute({ id });
    await prisma.vendorSettings.deleteMany();

    expect(refused.error).toBe(ISSUER_NOT_CONFIGURED);
    expect(rendered.value.content.subarray(0, 4).toString()).toBe(
      '%PDF'
    );
  });

  it('fails when the account does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Collection account not found/);
  });
});
