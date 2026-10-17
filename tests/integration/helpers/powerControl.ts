import { PrismaClient } from '../../../src/generated/prisma/client';
import { DeviceId } from '../../../src/domain/shared/ids';
import { PrismaDeviceCredentialsRepository } from '../../../src/infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { PrismaPoeSwitchTargetsQuery } from '../../../src/infrastructure/power-control';
import {
  GetDevicePowerSourceUseCase,
  SitePoeInspector,
  ListSitePoePortsUseCase
} from '../../../src/application/power-control';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakePoeSwitchReader } from './FakePoeSwitchReader';

export async function seedPoeSwitchModel(
  prisma: PrismaClient,
  firmware: 'ROUTEROS' | 'SWOS' = 'ROUTEROS'
): Promise<string> {
  const vendor = await prisma.vendor.upsert({
    where: { slug: 'mikrotik' },
    update: {},
    create: { name: 'MikroTik', slug: 'mikrotik', description: null }
  });
  const model =
    firmware === 'ROUTEROS' ? 'RB960PGS' : 'CSS106-1G-4P-1S';
  const row = await prisma.deviceModel.upsert({
    where: { vendorId_model: { vendorId: vendor.id, model } },
    update: { poeSwitchOs: firmware },
    create: {
      vendorId: vendor.id,
      model,
      deviceType: firmware === 'ROUTEROS' ? 'ROUTERBOARD' : 'SWITCH',
      poeSwitchOs: firmware
    }
  });
  return row.id;
}

export async function seedSite(
  prisma: PrismaClient,
  name: string
): Promise<string> {
  const location = await prisma.location.create({
    data: { name, type: 'TOWER' }
  });
  return location.id;
}

// A device at a site; its login is saved through the repository (the stored
// password is encrypted, so raw Prisma would not read back).
export async function seedSiteDevice(
  prisma: PrismaClient,
  opts: {
    name: string;
    deviceModelId: string;
    locationId: string | null;
    ip: string | null;
    login?: { username: string; password: string } | null;
    status?: 'ACTIVE' | 'COMMISSIONING' | 'INVENTORY';
    agentId?: string | null;
    httpPort?: number;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: opts.name,
      owner: 'COMPANY',
      status: opts.status ?? 'ACTIVE',
      ipAddress: opts.ip,
      locationId: opts.locationId,
      agentId: opts.agentId ?? null,
      deviceModelId: opts.deviceModelId
    }
  });
  if (opts.login) {
    const saved = await new PrismaDeviceCredentialsRepository(
      prisma
    ).save(DeviceId.parse(device.id).value, {
      snmpVersion: 2,
      snmpCommunity: null,
      snmpV3AuthUser: null,
      snmpV3AuthProto: null,
      snmpV3AuthKey: null,
      snmpV3PrivProto: null,
      snmpV3PrivKey: null,
      httpUsername: opts.login.username,
      httpPassword: opts.login.password,
      snmpPort: 161,
      httpPort: opts.httpPort ?? 443,
      sshPort: 22,
      apiPort: 8728
    });
    if (saved.isFailure) throw new Error(saved.error);
  }
  return device.id;
}

export function buildPowerControl(
  prisma: PrismaClient,
  reader: FakePoeSwitchReader,
  opts: { serverOnSite?: boolean } = {}
) {
  const logger = new WinstonLogger();
  const targets = new PrismaPoeSwitchTargetsQuery(
    prisma,
    opts.serverOnSite ?? true
  );
  const inspector = new SitePoeInspector(targets, reader);
  return {
    listSitePorts: new ListSitePoePortsUseCase(
      targets,
      inspector,
      logger
    ),
    getPowerSource: new GetDevicePowerSourceUseCase(
      targets,
      inspector,
      logger
    )
  };
}
