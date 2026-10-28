import { PrismaClient } from '../../../src/generated/prisma/client';
import { DeviceId } from '../../../src/domain/shared/ids';
import { PrismaDeviceCredentialsRepository } from '../../../src/infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { PrismaPortExpectedSpeedRepository } from '../../../src/infrastructure/persistence/PrismaPortExpectedSpeedRepository';
import { PrismaPortSpeedTargetsQuery } from '../../../src/infrastructure/monitoring/port-speeds/PrismaPortSpeedTargetsQuery';
import { RouterPortInspector } from '../../../src/application/device-monitoring/services';
import {
  AcceptCurrentPortSpeedsUseCase,
  ListRouterPortSpeedsUseCase,
  SetPortExpectedSpeedUseCase
} from '../../../src/application/device-monitoring/use-cases';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeRouterPortReader } from './FakeRouterPortReader';

type ModelType = 'ROUTERBOARD' | 'ROUTER' | 'SWITCH' | 'RADIO';

// A MikroTik model of the given type; `swos` marks a switch that runs SwOS.
export async function seedMikrotikModel(
  prisma: PrismaClient,
  deviceType: ModelType = 'ROUTERBOARD',
  opts: { swos?: boolean; vendorSlug?: string } = {}
): Promise<string> {
  const slug = opts.vendorSlug ?? 'mikrotik';
  const vendor = await prisma.vendor.upsert({
    where: { slug },
    update: {},
    create: { name: slug, slug, description: null }
  });
  const model = `${slug}-${deviceType}${opts.swos ? '-swos' : ''}`;
  const row = await prisma.deviceModel.upsert({
    where: { vendorId_model: { vendorId: vendor.id, model } },
    update: {},
    create: {
      vendorId: vendor.id,
      model,
      deviceType,
      poeSwitchOs: opts.swos ? 'SWOS' : null
    }
  });
  return row.id;
}

let nextHost = 100;

// A router and, unless `login` is null, its saved login (stored encrypted,
// so through the repository rather than raw Prisma). Without `ip`, each gets
// an address of its own: addresses are unique.
export async function seedRouter(
  prisma: PrismaClient,
  opts: {
    name: string;
    deviceModelId: string;
    ip?: string | null;
    login?: { username: string; password: string } | null;
    owner?: 'COMPANY' | 'CLIENT';
    status?: 'ACTIVE' | 'COMMISSIONING' | 'INVENTORY';
    category?: 'GATEWAY' | 'AGGREGATION_SWITCH' | 'CPE' | null;
    agentId?: string | null;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: opts.name,
      owner: opts.owner ?? 'COMPANY',
      status: opts.status ?? 'ACTIVE',
      category: opts.category ?? null,
      ipAddress:
        opts.ip === undefined ? `10.9.0.${nextHost++}` : opts.ip,
      agentId: opts.agentId ?? null,
      deviceModelId: opts.deviceModelId
    }
  });
  const login =
    opts.login === undefined
      ? { username: 'admin', password: 'secret' }
      : opts.login;
  if (login) {
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
      httpUsername: login.username,
      httpPassword: login.password,
      snmpPort: 161,
      httpPort: 443,
      sshPort: 22,
      apiPort: 8729
    });
    if (saved.isFailure) throw new Error(saved.error);
  }
  return device.id;
}

export async function seedExpectedSpeed(
  prisma: PrismaClient,
  deviceId: string,
  portName: string,
  expectedMbps: number
): Promise<void> {
  await prisma.portExpectedSpeed.create({
    data: { deviceId, portName, expectedMbps }
  });
}

// The stored expectations of one router, port name → Mbps.
export async function expectedSpeedsOf(
  prisma: PrismaClient,
  deviceId: string
): Promise<Record<string, number>> {
  const rows = await prisma.portExpectedSpeed.findMany({
    where: { deviceId }
  });
  return Object.fromEntries(
    rows.map((r) => [r.portName, r.expectedMbps])
  );
}

export function buildPortSpeeds(
  prisma: PrismaClient,
  reader: FakeRouterPortReader,
  opts: { serverOnSite?: boolean } = {}
) {
  const logger = new WinstonLogger();
  const targets = new PrismaPortSpeedTargetsQuery(
    prisma,
    opts.serverOnSite ?? true
  );
  const repository = new PrismaPortExpectedSpeedRepository(prisma);
  const inspector = new RouterPortInspector(reader, repository);
  return {
    list: new ListRouterPortSpeedsUseCase(targets, inspector, logger),
    setExpected: new SetPortExpectedSpeedUseCase(
      targets,
      repository,
      logger
    ),
    acceptCurrent: new AcceptCurrentPortSpeedsUseCase(
      targets,
      inspector,
      repository,
      logger
    )
  };
}
