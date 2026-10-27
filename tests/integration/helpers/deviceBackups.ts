import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  BackUpDeviceNowUseCase,
  DeviceConfigBackupService,
  DownloadDeviceBackupUseCase,
  ListDeviceBackupsUseCase,
  RunScheduledBackupsUseCase
} from 'application/device-backups';
import {
  PrismaBackupTargetsQuery,
  PrismaConfigBackupRepository,
  PrismaDeviceBackupStateRepository
} from 'infrastructure/device-backups';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { CredentialsEncryption } from 'infrastructure/crypto';
import { IAgentConfigFetcher } from 'application/device-backups/interfaces';
import { FakeConfigFetcher } from './FakeConfigFetcher';

export const FAKE_ROUTEROS_EXPORT =
  '# 2026-10-07 03:00:01 by RouterOS 7.15\n/ip address\nadd address=10.0.0.1/24 interface=ether1\n';

/**
 * A router or switch of `vendorSlug`, with a login and an SSH port. Returns
 * the device id.
 */
export async function seedRouter(
  prisma: PrismaClient,
  opts: {
    ip: string;
    vendorSlug?: string;
    deviceType?: 'ROUTER' | 'ROUTERBOARD' | 'SWITCH' | 'SERVER';
    status?: 'ACTIVE' | 'COMMISSIONING' | 'INVENTORY';
    sshPort?: number;
    owner?: 'COMPANY' | 'CLIENT' | null;
  }
): Promise<string> {
  const vendorSlug = opts.vendorSlug ?? 'mikrotik';
  const deviceType = opts.deviceType ?? 'ROUTERBOARD';
  const vendor = await prisma.vendor.upsert({
    where: { slug: vendorSlug },
    create: { name: vendorSlug, slug: vendorSlug },
    update: {}
  });
  const model = await prisma.deviceModel.upsert({
    where: {
      vendorId_model: {
        vendorId: vendor.id,
        model: `Backup ${deviceType}`
      }
    },
    create: {
      vendorId: vendor.id,
      model: `Backup ${deviceType}`,
      deviceType
    },
    update: {}
  });
  const device = await prisma.device.create({
    data: {
      name: `Router ${opts.ip}`,
      status: opts.status ?? 'ACTIVE',
      owner: opts.owner === undefined ? 'COMPANY' : opts.owner,
      ipAddress: opts.ip,
      deviceModelId: model.id
    }
  });
  await prisma.deviceCredentials.create({
    data: {
      deviceId: device.id,
      httpUsername: 'admin',
      httpPassword: CredentialsEncryption.encrypt('router-secret'),
      ...(opts.sshPort !== undefined && { sshPort: opts.sshPort })
    }
  });
  return device.id;
}

export interface DeviceBackupStack {
  backUpNow: BackUpDeviceNowUseCase;
  list: ListDeviceBackupsUseCase;
  download: DownloadDeviceBackupUseCase;
  runScheduled: RunScheduledBackupsUseCase;
}

/**
 * The backup use cases over real repositories, with the device download
 * replaced by a fake, and the agents too when `agent` is given. `clock`
 * fixes the time a manual backup is taken at.
 */
export function buildDeviceBackups(
  prisma: PrismaClient,
  fetcher: FakeConfigFetcher,
  opts: {
    serverOnSite?: boolean;
    clock?: () => Date;
    agent?: IAgentConfigFetcher;
  } = {}
): DeviceBackupStack {
  const logger = new WinstonLogger();
  const targets = new PrismaBackupTargetsQuery(
    prisma,
    opts.serverOnSite ?? true
  );
  const backups = new PrismaConfigBackupRepository(prisma);
  const states = new PrismaDeviceBackupStateRepository(prisma);
  const service = new DeviceConfigBackupService(
    fetcher,
    backups,
    states,
    opts.agent
  );

  return {
    backUpNow: new BackUpDeviceNowUseCase(
      targets,
      service,
      logger,
      opts.clock
    ),
    list: new ListDeviceBackupsUseCase(
      targets,
      backups,
      states,
      logger
    ),
    download: new DownloadDeviceBackupUseCase(
      targets,
      backups,
      logger
    ),
    runScheduled: new RunScheduledBackupsUseCase(
      targets,
      states,
      service,
      logger
    )
  };
}
