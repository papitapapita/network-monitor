import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  BackUpDeviceNowUseCase,
  DeviceConfigBackupService,
  DiffDeviceBackupsUseCase,
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
import { FakeConfigFetcher } from './FakeConfigFetcher';

export interface DeviceBackupStack {
  backUpNow: BackUpDeviceNowUseCase;
  list: ListDeviceBackupsUseCase;
  download: DownloadDeviceBackupUseCase;
  diff: DiffDeviceBackupsUseCase;
  runScheduled: RunScheduledBackupsUseCase;
}

/**
 * The backup use cases over real repositories, with the radio download
 * replaced by a fake. `clock` fixes the time a manual backup is taken at.
 */
export function buildDeviceBackups(
  prisma: PrismaClient,
  fetcher: FakeConfigFetcher,
  opts: { serverOnSite?: boolean; clock?: () => Date } = {}
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
    states
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
    diff: new DiffDeviceBackupsUseCase(targets, backups, logger),
    runScheduled: new RunScheduledBackupsUseCase(
      targets,
      states,
      service,
      logger
    )
  };
}
