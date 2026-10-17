// Source: src/application/power-control/use-cases/GetDevicePowerSourceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import {
  FakePoeSwitchReader,
  poweredPort
} from '../../helpers/FakePoeSwitchReader';
import {
  buildPowerControl,
  seedPoeSwitchModel,
  seedSite,
  seedSiteDevice
} from '../../helpers/powerControl';

const LOGIN = { username: 'admin', password: 'secret' };

describe('GetDevicePowerSourceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let hexModelId: string;
  let antennaModelId: string;
  let towerId: string;
  const reader = new FakePoeSwitchReader();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    await cleanDatabase(prisma);
    hexModelId = await seedPoeSwitchModel(prisma, 'ROUTEROS');
    antennaModelId = await seedWirelessDeviceModel(prisma);
    towerId = await seedSite(prisma, 'Torre Norte');
  });

  const powerSource = (deviceId: string) =>
    buildPowerControl(prisma, reader).getPowerSource.execute({
      deviceId
    });

  const seedHex = (name: string, ip: string) =>
    seedSiteDevice(prisma, {
      name,
      deviceModelId: hexModelId,
      locationId: towerId,
      ip,
      login: LOGIN
    });

  const seedRocket = (
    opts: { ip?: string | null; locationId?: string | null } = {}
  ) =>
    seedSiteDevice(prisma, {
      name: 'Rocket Norte',
      deviceModelId: antennaModelId,
      locationId:
        opts.locationId === undefined ? towerId : opts.locationId,
      ip: opts.ip === undefined ? '10.0.5.21' : opts.ip
    });

  it('[PWR-040] should find the one port that powers the antenna', async () => {
    const hexId = await seedHex('hEX Torre Norte', '10.0.5.2');
    const rocketId = await seedRocket();
    reader.serve('10.0.5.2', [
      poweredPort('ether2', 'spare'),
      poweredPort('ether3', '10.0.5.21', 6.4)
    ]);

    const result = await powerSource(rocketId);

    expect(result.value).toEqual({
      deviceId: rocketId,
      kind: 'FOUND',
      reason: null,
      sources: [
        {
          switchDeviceId: hexId,
          switchName: 'hEX Torre Norte',
          port: 'ether3',
          mode: 'AUTO',
          status: 'POWERED',
          powerWatts: 6.4
        }
      ],
      unreadSwitches: []
    });
  });

  it('[PWR-040] should answer DUPLICATE when two ports name it', async () => {
    await seedHex('hEX A', '10.0.5.2');
    await seedHex('hEX B', '10.0.5.4');
    const rocketId = await seedRocket();
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);
    reader.serve('10.0.5.4', [poweredPort('ether5', '10.0.5.21')]);

    const result = await powerSource(rocketId);

    expect(result.value.kind).toBe('DUPLICATE');
    expect(result.value.sources.map((s) => s.port)).toEqual([
      'ether2',
      'ether5'
    ]);
  });

  it('[PWR-040] should answer UNKNOWN when not found and a switch did not answer', async () => {
    const hexId = await seedHex('hEX A', '10.0.5.2');
    await seedHex('hEX B', '10.0.5.4');
    const rocketId = await seedRocket();
    reader.answer(
      '10.0.5.2',
      Result.fail('RouterOS API error: timeout')
    );
    reader.serve('10.0.5.4', [poweredPort('ether2', 'spare')]);

    const result = await powerSource(rocketId);

    expect(result.value).toMatchObject({
      kind: 'UNKNOWN',
      sources: [],
      unreadSwitches: [
        {
          deviceId: hexId,
          name: 'hEX A',
          reason: 'RouterOS API error: timeout'
        }
      ]
    });
  });

  it('[PWR-040] should answer NONE when every switch was read and none names it', async () => {
    await seedHex('hEX', '10.0.5.2');
    const rocketId = await seedRocket();
    reader.serve('10.0.5.2', [poweredPort('ether2', 'spare')]);

    const result = await powerSource(rocketId);

    expect(result.value).toMatchObject({
      kind: 'NONE',
      reason:
        'No PoE port at the device location is labelled with its IP'
    });
  });

  it('[PWR-041] should only look at the switches at its own location', async () => {
    const otherSite = await seedSite(prisma, 'Torre Sur');
    await seedSiteDevice(prisma, {
      name: 'hEX Sur',
      deviceModelId: hexModelId,
      locationId: otherSite,
      ip: '10.0.6.2',
      login: LOGIN
    });
    const rocketId = await seedRocket();

    const result = await powerSource(rocketId);

    expect(reader.reads).toEqual([]);
    expect(result.value).toMatchObject({
      kind: 'NONE',
      reason: 'There is no PoE switch at the device location'
    });
  });

  it('[PWR-041] should answer NONE for a device without a location', async () => {
    const rocketId = await seedRocket({ locationId: null });

    const result = await powerSource(rocketId);

    expect(result.value).toMatchObject({
      kind: 'NONE',
      reason: 'The device has no location, so no switch is looked at'
    });
  });

  it('[PWR-041] should answer NONE for a device without an IP', async () => {
    const rocketId = await seedRocket({ ip: null });

    const result = await powerSource(rocketId);

    expect(result.value).toMatchObject({
      kind: 'NONE',
      reason: 'The device has no IP address'
    });
  });

  it('should fail for an unknown device', async () => {
    const result = await powerSource(GHOST_ID);

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed id', async () => {
    const result = await powerSource(INVALID_ID);

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
