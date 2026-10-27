// Source: src/application/device-inventory/use-cases/AcceptUpstreamSuggestionsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AcceptUpstreamSuggestionsUseCase } from 'application/device-inventory/use-cases';
import { PrismaDeviceRepository } from 'infrastructure/persistence';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedNetworkDevice,
  GHOST_ID
} from '../../helpers/db';

describe('AcceptUpstreamSuggestionsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AcceptUpstreamSuggestionsUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new AcceptUpstreamSuggestionsUseCase(
      new PrismaDeviceRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedDeviceModel(prisma);
  });

  const seed = (
    name: string,
    ipAddress: string,
    opts: Partial<Parameters<typeof seedNetworkDevice>[2]> = {}
  ) =>
    seedNetworkDevice(prisma, deviceModelId, {
      name,
      ipAddress,
      ...opts
    });

  const upstreamOf = async (id: string) =>
    (await prisma.device.findUniqueOrThrow({ where: { id } }))
      .upstreamDeviceId;

  it('[DEV-194] stores every accepted link', async () => {
    const sw = await seed('Switch', '10.0.0.2');
    const ap = await seed('AP', '10.0.0.3');
    const cpe = await seed('CPE', '10.0.0.4');

    const result = await useCase.execute({
      links: [
        { deviceId: ap, upstreamDeviceId: sw },
        { deviceId: cpe, upstreamDeviceId: ap }
      ]
    });

    expect(result.value).toMatchObject({ linked: 2, failed: 0 });
    expect(await upstreamOf(ap)).toBe(sw);
    expect(await upstreamOf(cpe)).toBe(ap);
  });

  it('[DEV-194] judges a later link against the ones made before it', async () => {
    const a = await seed('A', '10.0.0.2');
    const b = await seed('B', '10.0.0.3');

    const result = await useCase.execute({
      links: [
        { deviceId: a, upstreamDeviceId: b },
        { deviceId: b, upstreamDeviceId: a }
      ]
    });

    expect(result.value.results.map((r) => r.outcome)).toEqual([
      'LINKED',
      'FAILED'
    ]);
    expect(result.value.results[1].error).toContain('loop');
    expect(await upstreamOf(b)).toBeNull();
  });

  it('[DEV-194] keeps going past a refused link', async () => {
    const shelf = await seed('Shelf', '10.0.0.2', {
      status: 'INVENTORY'
    });
    const ap = await seed('AP', '10.0.0.3');
    const cpe1 = await seed('CPE 1', '10.0.0.4');
    const cpe2 = await seed('CPE 2', '10.0.0.5');

    const result = await useCase.execute({
      links: [
        { deviceId: cpe1, upstreamDeviceId: shelf },
        { deviceId: GHOST_ID, upstreamDeviceId: ap },
        { deviceId: cpe2, upstreamDeviceId: ap }
      ]
    });

    expect(result.value).toMatchObject({ linked: 1, failed: 2 });
    expect(await upstreamOf(cpe1)).toBeNull();
    expect(await upstreamOf(cpe2)).toBe(ap);
  });

  it('[DEV-194] reports a link already in place as UNCHANGED', async () => {
    const ap = await seed('AP', '10.0.0.3');
    const cpe = await seed('CPE', '10.0.0.4', {
      upstreamDeviceId: ap
    });

    const result = await useCase.execute({
      links: [{ deviceId: cpe, upstreamDeviceId: ap }]
    });

    expect(result.value.results[0].outcome).toBe('UNCHANGED');
  });

  it('[DEV-194] replaces a link the device already had', async () => {
    const ap1 = await seed('AP 1', '10.0.0.3');
    const ap2 = await seed('AP 2', '10.0.0.6');
    const cpe = await seed('CPE', '10.0.0.4', {
      upstreamDeviceId: ap1
    });

    await useCase.execute({
      links: [{ deviceId: cpe, upstreamDeviceId: ap2 }]
    });

    expect(await upstreamOf(cpe)).toBe(ap2);
  });

  it('reports a malformed device id per link', async () => {
    const ap = await seed('AP', '10.0.0.3');

    const result = await useCase.execute({
      links: [{ deviceId: 'nope', upstreamDeviceId: ap }]
    });

    expect(result.value.results[0]).toMatchObject({
      outcome: 'FAILED'
    });
    expect(result.value.results[0].error).toContain(
      'Invalid device ID'
    );
  });
});
