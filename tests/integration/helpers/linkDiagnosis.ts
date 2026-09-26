import { PrismaClient } from '../../../src/generated/prisma/client';
import { IEventStreamHub } from 'application/shared/interfaces';
import { IPingService } from 'application/device-monitoring/interfaces';
import {
  StartLinkDiagnosisUseCase,
  GetLinkDiagnosisUseCase,
  StopLinkDiagnosisUseCase
} from 'application/wireless-monitoring/use-cases';
import { SetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import {
  WirelessAlertEvaluator,
  LinkDiagnosisAnalyzer
} from 'domain/wireless-monitoring/services';
import { SignalStrengthRule } from 'domain/wireless-monitoring/services/rules/SignalStrengthRule';
import {
  LinkDiagnosisRunner,
  LinkDiagnosisRunnerConfig
} from 'infrastructure/wireless-monitoring/diagnosis/LinkDiagnosisRunner';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { WirelessDeviceRepositoryAdapter } from 'infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { DeviceVendorAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter';
import { ContractedCapacityAdapter } from 'infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import {
  PrismaContractedServiceRepository,
  PrismaServicePlanRepository
} from 'infrastructure/customers';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeWirelessCollector } from './FakeWirelessCollector';

export interface LinkDiagnosisStack {
  runner: LinkDiagnosisRunner;
  start: StartLinkDiagnosisUseCase;
  get: GetLinkDiagnosisUseCase;
  stop: StopLinkDiagnosisUseCase;
}

/**
 * The live-diagnosis use cases over real repositories, with the two
 * outbound ports that would reach a radio — ping and the HTTP collector —
 * replaced by fakes. Stop the runner (runner.stopAll()) after each test.
 */
export function buildLinkDiagnosis(
  prisma: PrismaClient,
  hub: IEventStreamHub,
  fakes: { ping: IPingService; collector: FakeWirelessCollector },
  config: LinkDiagnosisRunnerConfig = {}
): LinkDiagnosisStack {
  const logger = new WinstonLogger();
  const deviceRepo = new PrismaDeviceRepository(prisma);

  const runner = new LinkDiagnosisRunner(
    hub,
    fakes.ping,
    new WirelessAlertEvaluator([new SignalStrengthRule()]),
    new LinkDiagnosisAnalyzer(),
    logger,
    config
  );

  const start = new StartLinkDiagnosisUseCase(
    new PrismaWirelessDeviceConfigRepository(prisma),
    new PrismaWirelessSnapshotRepository(prisma),
    new PrismaDeviceCredentialsRepository(prisma),
    fakes.collector,
    new DeviceVendorAdapter(
      deviceRepo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaVendorRepository(prisma)
    ),
    new WirelessDeviceRepositoryAdapter(
      deviceRepo,
      new DeviceEligibilityService()
    ),
    new ContractedCapacityAdapter(
      new PrismaContractedServiceRepository(prisma),
      new PrismaServicePlanRepository(prisma)
    ),
    runner,
    logger
  );

  return {
    runner,
    start,
    get: new GetLinkDiagnosisUseCase(runner, logger),
    stop: new StopLinkDiagnosisUseCase(runner, logger)
  };
}

/**
 * A wireless device ready to diagnose: ACTIVE, monitored, with a wireless
 * config and (unless withCredentials is false) HTTP credentials.
 * Returns the device id.
 */
export async function seedDiagnosableDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  opts: {
    ip: string;
    deviceType?: 'STATION' | 'ACCESS_POINT';
    parentApDeviceId?: string;
    withCredentials?: boolean;
    withConfig?: boolean;
    monitoringEnabled?: boolean;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: `Radio ${opts.ip}`,
      owner: 'COMPANY',
      status: 'ACTIVE',
      category:
        opts.deviceType === 'ACCESS_POINT'
          ? 'ACCESS_POINT'
          : 'WIRELESS_CPE',
      monitoringEnabled: opts.monitoringEnabled ?? true,
      ipAddress: opts.ip,
      deviceModelId
    }
  });

  if (opts.withConfig ?? true) {
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: device.id,
        ipAddress: opts.ip,
        enabled: true,
        intervalSecs: 3600,
        deviceType: opts.deviceType ?? 'STATION',
        parentApDeviceId: opts.parentApDeviceId ?? null
      }
    });
  }

  if (opts.withCredentials ?? true) {
    const logger = new WinstonLogger();
    const stored = await new SetDeviceCredentialsUseCase(
      new PrismaDeviceRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      logger
    ).execute({
      deviceId: device.id,
      httpUsername: 'ubnt',
      httpPassword: 'secret'
    });
    if (stored.isFailure) {
      throw new Error(`Failed to seed credentials: ${stored.error}`);
    }
  }

  return device.id;
}
