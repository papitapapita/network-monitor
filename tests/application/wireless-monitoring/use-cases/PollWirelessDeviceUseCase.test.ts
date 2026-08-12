// Source: src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts

import { PollWirelessDeviceUseCase } from '../../../../src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase';
import { AlertDecision, IWirelessAlertEvaluator } from '../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { IDeviceCredentialsRepository, DecryptedCredentials } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceCredentialsRepository';
import { IUbiquitiHttpCollector, HttpCollectionResult } from '../../../../src/application/wireless-monitoring/interfaces/IUbiquitiHttpCollector';
import { IDeviceRepository } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceRepository';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_IP = '192.168.1.100';

// ---------------------------------------------------------------------------
// Logger stub
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

// ---------------------------------------------------------------------------
// Domain object helpers
// ---------------------------------------------------------------------------

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makePollingConfig(overrides: {
  enabled?: boolean;
  deviceType?: 'STATION' | 'ACCESS_POINT';
  linkCapacityKbps?: number | null;
  clientsProvisionedLimit?: number | null;
  ipAddress?: IPAddress | null;
} = {}): WirelessDeviceConfig {
  const ipResult = IPAddress.create(VALID_IP);
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: makeDeviceId(),
      ipAddress: overrides.ipAddress !== undefined ? overrides.ipAddress : ipResult.value,
      enabled: overrides.enabled !== undefined ? overrides.enabled : true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: overrides.deviceType ?? 'STATION',
      linkCapacityKbps: overrides.linkCapacityKbps !== undefined ? overrides.linkCapacityKbps : null,
      clientsProvisionedLimit: overrides.clientsProvisionedLimit !== undefined ? overrides.clientsProvisionedLimit : null,
      lastPolledAt: null,
    }
  );
}

function makeCredentials(): DecryptedCredentials {
  return {
    snmpVersion: 2,
    snmpCommunity: null,
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    httpUsername: 'ubnt',
    httpPassword: 'ubnt',
    snmpPort: 161,
    httpPort: 443
  };
}

function makeHttpResult(overrides: Partial<HttpCollectionResult> = {}): HttpCollectionResult {
  return {
    deviceName: 'CPE-001',
    firmwareVersion: 'WA.v8.7.5',
    uptimeSeconds: 86400,
    deviceTimeEpoch: null,
    cpuLoadPercent: 30,
    memoryUsedPercent: 50,
    essid: 'ISP-Network',
    mode: 'sta-ptmp',
    frequencyMhz: 5180,
    channelWidthMhz: 40,
    noiseFloorDbm: -90,
    throughputTxBps: 5_000_000,
    throughputRxBps: 3_000_000,
    distanceM: 1500,
    clientsConnected: null,
    ccqPercent: null,
    signalRxDbm: -65,
    signalTxDbm: null,
    latencyMs: 4,
    remoteApMac: 'AA:BB:CC:DD:EE:FF',
    remoteApName: 'AP-Roof',
    remoteApIp: null,
    capacityTxKbps: null,
    capacityRxKbps: null,
    lanStatus: 'UP',
    lanSpeedMbps: 1000,
    macAddress: null,
    deviceModel: null,
    clients: [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMocks() {
  const wirelessDeviceConfigRepo: jest.Mocked<IWirelessDeviceConfigRepository> = {
    findByDeviceId: jest.fn(),
    save: jest.fn(),
    findAllDue: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn()
  };

  const snapshotRepo: jest.Mocked<IWirelessSnapshotRepository> = {
    save: jest.fn(),
    findById: jest.fn(),
    findLatestByDevice: jest.fn(),
    findLatestForAllDevices: jest.fn(),
    findHistoryByDevice: jest.fn(),
    deleteOlderThan: jest.fn()
  };

  const alertRecordRepo: jest.Mocked<IWirelessAlertRecordRepository> = {
    save: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
    findActiveByDeviceMetricAndSeverity: jest.fn(),
    findAllActiveByDevice: jest.fn(),
    findActiveUnnotifiedByDevice: jest.fn(),
    findAllActive: jest.fn(),
    findHistoryByDevice: jest.fn(),
    deleteClearedOlderThan: jest.fn()
  };

  const credentialsRepo: jest.Mocked<IDeviceCredentialsRepository> = {
    findByDeviceId: jest.fn()
  };

  const httpCollector: jest.Mocked<IUbiquitiHttpCollector> = {
    collect: jest.fn()
  };

  const alertEvaluator: jest.Mocked<IWirelessAlertEvaluator> = {
    evaluate: jest.fn()
  };

  const deviceRepo: jest.Mocked<IDeviceRepository> = {
    findIdByMacAddress: jest.fn().mockResolvedValue(Result.ok(null))
  };

  const alertPublisher: jest.Mocked<IAlertPublisher> = {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };

  const logger = makeLogger();

  return {
    wirelessDeviceConfigRepo,
    snapshotRepo,
    alertRecordRepo,
    credentialsRepo,
    httpCollector,
    alertEvaluator,
    deviceRepo,
    alertPublisher,
    logger
  };
}

function makeUseCase(mocks: ReturnType<typeof makeMocks>): PollWirelessDeviceUseCase {
  return new PollWirelessDeviceUseCase(
    mocks.wirelessDeviceConfigRepo,
    mocks.snapshotRepo,
    mocks.alertRecordRepo,
    mocks.credentialsRepo,
    mocks.httpCollector,
    mocks.alertEvaluator,
    mocks.deviceRepo,
    mocks.alertPublisher,
    mocks.logger
  );
}

function configureHappyPath(
  mocks: ReturnType<typeof makeMocks>,
  options: {
    httpFails?: boolean;
    enabled?: boolean;
    deviceType?: 'STATION' | 'ACCESS_POINT';
  } = {}
): void {
  const config = makePollingConfig({
    enabled: options.enabled !== undefined ? options.enabled : true,
    deviceType: options.deviceType ?? 'STATION'
  });

  mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(config));
  mocks.wirelessDeviceConfigRepo.save.mockResolvedValue(Result.ok(config));
  mocks.credentialsRepo.findByDeviceId.mockResolvedValue(Result.ok(makeCredentials()));

  mocks.httpCollector.collect.mockResolvedValue(
    options.httpFails
      ? Result.fail('HTTPS_TIMEOUT')
      : Result.ok(makeHttpResult())
  );

  mocks.alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));
  mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
    Result.ok([])
  );
  mocks.snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(null));
  mocks.alertEvaluator.evaluate.mockReturnValue([]);
  mocks.snapshotRepo.save.mockImplementation((snapshot) =>
    Promise.resolve(Result.ok(snapshot))
  );
  mocks.alertRecordRepo.save.mockImplementation((record) =>
    Promise.resolve(Result.ok(record))
  );
  mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
    Result.ok(null)
  );
}

function makeHttpClient(overrides = {}) {
  return {
    macAddress: '11:22:33:44:55:66',
    ipAddress: '10.0.0.5',
    signalRxDbm: -62,
    noiseFloorDbm: -92,
    distanceM: 800,
    uptimeSeconds: 3600,
    txLatencyMs: 3,
    dlLinkScore: 90,
    ulLinkScore: 88,
    dlCapacityKbps: 120_000,
    ulCapacityKbps: 90_000,
    dlCinr: 25,
    ulCinr: 24,
    txBytesTotal: 100n,
    rxBytesTotal: 200n,
    txPps: 10,
    rxPps: 12,
    remoteHostname: 'CPE-remote',
    remotePlatform: 'NanoStation',
    remoteVersion: 'WA.v8.7.5',
    remoteCpuLoad: 20,
    remoteTotalRam: 64_000,
    remoteFreeRam: 30_000,
    remoteSignal: -63,
    remoteNoiseFloor: -92,
    remoteTxPower: 20,
    remoteTxThroughputKbps: 1000,
    remoteRxThroughputKbps: 900,
    remoteIpAddresses: ['10.0.0.5'],
    dlAirtimePercent: 30,
    ulAirtimePercent: 25,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-021] [WLS-024] [WLS-028] [WLS-125] PollWirelessDeviceUseCase', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let useCase: PollWirelessDeviceUseCase;

  beforeEach(() => {
    mocks = makeMocks();
    useCase = makeUseCase(mocks);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call any repository when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(mocks.wirelessDeviceConfigRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-valid-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should NOT call wirelessDeviceConfigRepo when deviceId is not a valid UUID', async () => {
      await useCase.execute({ deviceId: 'bad-id' });

      expect(mocks.wirelessDeviceConfigRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — polling config loading', () => {
    it('should fail when config repository returns a failure', async () => {
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB connection error')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load wireless polling config');
    });

    it('should fail when no config exists for the device', async () => {
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No wireless polling configuration found');
    });

    it('should NOT call credentialsRepo when config is not found', async () => {
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.credentialsRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — disabled polling (skip logic)', () => {
    it('should return ok with skipped=true when config is disabled and forceExecution is absent', async () => {
      const config = makePollingConfig({ enabled: false });
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.skipped).toBe(true);
    });

    it('should return ok with skipped=true when forceExecution is explicitly false', async () => {
      const config = makePollingConfig({ enabled: false });
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        forceExecution: false
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.skipped).toBe(true);
    });

    it('should set metricsCollected to false in the skipped result', async () => {
      const config = makePollingConfig({ enabled: false });
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.metricsCollected).toBe(false);
    });

    it('should NOT call snapshotRepo.save when skipped', async () => {
      const config = makePollingConfig({ enabled: false });
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.snapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should proceed normally when config is disabled but forceExecution is true', async () => {
      configureHappyPath(mocks, { enabled: false });

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        forceExecution: true
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.skipped).toBeUndefined();
      expect(mocks.snapshotRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — credentials loading', () => {
    it('should fail when credentials repository returns a failure', async () => {
      const config = makePollingConfig();
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      mocks.credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.fail('Vault unavailable')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load credentials');
    });

    it('should fail when no credentials exist for the device', async () => {
      const config = makePollingConfig();
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      mocks.credentialsRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No credentials configured for device');
    });
  });

  // ===========================================================================
  describe('executeImpl — IP address requirement', () => {
    it('should fail when no IP address is configured on the polling config', async () => {
      const config = makePollingConfig({ ipAddress: null });
      mocks.wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      mocks.credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeCredentials())
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device has no IP address configured');
    });
  });

  // ===========================================================================
  describe('executeImpl — collection method', () => {
    it('should always set collectionMethod to "http_api"', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.collectionMethod).toBe('http_api');
    });

    it('should fail when HTTP collector fails', async () => {
      configureHappyPath(mocks, { httpFails: true });

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to collect metrics');
    });

    it('should NOT call snapshotRepo.save when HTTP collector fails', async () => {
      configureHappyPath(mocks, { httpFails: true });

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.snapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should pass the deviceType to the HTTP collector', async () => {
      configureHappyPath(mocks, { deviceType: 'ACCESS_POINT' });

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.httpCollector.collect).toHaveBeenCalledWith(
        VALID_IP,
        expect.objectContaining({ username: 'ubnt' }),
        'ACCESS_POINT'
      );
    });
  });

  // ===========================================================================
  describe('executeImpl — alert evaluation (OPEN decisions)', () => {
    it('should call alertEvaluator.evaluate exactly once per execution', async () => {
      configureHappyPath(mocks);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertEvaluator.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should call alertRecordRepo.save once per OPEN decision', async () => {
      configureHappyPath(mocks);
      const openDecisions: AlertDecision[] = [
        {
          metric: 'signal_rx_dbm',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: -72,
          threshold: -70,
          message: 'a',
        },
        {
          metric: 'cpu_load_percent',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 85,
          threshold: 80,
          message: 'b',
        }
      ];
      mocks.alertEvaluator.evaluate.mockReturnValue(openDecisions);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertRecordRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should report alertsTriggered equal to the number of OPEN decisions', async () => {
      configureHappyPath(mocks);
      const openDecisions: AlertDecision[] = [
        {
          metric: 'signal_rx_dbm',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: -72,
          threshold: -70,
          message: 'a',
        },
        {
          metric: 'cpu_load_percent',
          action: 'OPEN',
          severity: 'WARNING',
          currentValue: 85,
          threshold: 80,
          message: 'b',
        }
      ];
      mocks.alertEvaluator.evaluate.mockReturnValue(openDecisions);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.alertsTriggered).toBe(2);
    });

    it('should log an error but still succeed when an alert record save fails', async () => {
      configureHappyPath(mocks);
      const openDecision: AlertDecision = {
        metric: 'signal_rx_dbm',
        action: 'OPEN',
        severity: 'WARNING',
        currentValue: -72,
        threshold: -70,
        message: 'Signal weak',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([openDecision]);
      mocks.alertRecordRepo.save.mockResolvedValueOnce(
        Result.fail('DB constraint')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(mocks.logger.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — pending alert notification delivery', () => {
    function makePendingRecord(
      severity: 'WARNING' | 'CRITICAL' = 'CRITICAL'
    ): WirelessAlertRecord {
      return WirelessAlertRecord.open(
        makeDeviceId(),
        'signal_rx_dbm',
        severity,
        -80,
        -83,
        'Señal crítica'
      ).value;
    }

    it('should notify each alert awaiting delivery', async () => {
      configureHappyPath(mocks);
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.ok([makePendingRecord(), makePendingRecord('WARNING')])
      );
      mocks.alertRecordRepo.save.mockResolvedValue(
        Result.ok(makePendingRecord())
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertPublisher.publish).toHaveBeenCalledTimes(
        2
      );
    });

    it('should persist the delivery timestamp after a successful send', async () => {
      configureHappyPath(mocks);
      const record = makePendingRecord();
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.ok([record])
      );
      mocks.alertRecordRepo.save.mockResolvedValue(Result.ok(record));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(record.isNotified).toBe(true);
      expect(mocks.alertRecordRepo.save).toHaveBeenCalledWith(record);
    });

    it('should leave the alert un-notified when delivery fails, so it retries', async () => {
      configureHappyPath(mocks);
      const record = makePendingRecord();
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.ok([record])
      );
      mocks.alertPublisher.publish.mockResolvedValue(
        Result.fail('telegram down')
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(record.isNotified).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('should keep delivering later alerts when one fails', async () => {
      configureHappyPath(mocks);
      const first = makePendingRecord();
      const second = makePendingRecord('WARNING');
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.ok([first, second])
      );
      mocks.alertPublisher.publish
        .mockResolvedValueOnce(Result.fail('telegram down'))
        .mockResolvedValueOnce(Result.ok());
      mocks.alertRecordRepo.save.mockResolvedValue(Result.ok(second));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(first.isNotified).toBe(false);
      expect(second.isNotified).toBe(true);
    });

    it('should carry the alert severity into the notification', async () => {
      configureHappyPath(mocks);
      const record = makePendingRecord('WARNING');
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.ok([record])
      );
      mocks.alertRecordRepo.save.mockResolvedValue(Result.ok(record));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.WARNING,
          subject: 'signal_rx_dbm',
          resolved: false
        })
      );
    });

    it('should still complete the poll when the pending lookup fails', async () => {
      configureHappyPath(mocks);
      mocks.alertRecordRepo.findActiveUnnotifiedByDevice.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(mocks.alertPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('executeImpl — alert evaluation (CLEAR decisions)', () => {
    it('should call alertRecordRepo.findActiveByDeviceMetricAndSeverity for each CLEAR decision', async () => {
      configureHappyPath(mocks);

      const activeRecord = WirelessAlertRecord.open(
        makeDeviceId(),
        'signal_rx_dbm',
        'WARNING',
        -70,
        -72,
        'test'
      ).value;
      mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
        Result.ok(activeRecord)
      );

      const clearDecision: AlertDecision = {
        metric: 'signal_rx_dbm',
        action: 'CLEAR',
        severity: 'WARNING',
        currentValue: -65,
        threshold: -70,
        message: 'Signal recovered',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([clearDecision]);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(
        mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity
      ).toHaveBeenCalledTimes(1);
    });

    it('should look up the active alert by the severity of the CLEAR decision', async () => {
      configureHappyPath(mocks);

      const activeRecord = WirelessAlertRecord.open(
        makeDeviceId(),
        'snr_db',
        'CRITICAL',
        10,
        8,
        'test'
      ).value;
      mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
        Result.ok(activeRecord)
      );

      const clearDecision: AlertDecision = {
        metric: 'snr_db',
        action: 'CLEAR',
        severity: 'CRITICAL',
        currentValue: 13,
        threshold: 10,
        message: 'SNR recovered',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([clearDecision]);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(
        mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity
      ).toHaveBeenCalledWith(expect.anything(), 'snr_db', 'CRITICAL');
    });

    it('should call alertRecordRepo.save after clearing the active alert', async () => {
      configureHappyPath(mocks);

      const activeRecord = WirelessAlertRecord.open(
        makeDeviceId(),
        'signal_rx_dbm',
        'WARNING',
        -70,
        -72,
        'test'
      ).value;
      mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
        Result.ok(activeRecord)
      );

      const clearDecision: AlertDecision = {
        metric: 'signal_rx_dbm',
        action: 'CLEAR',
        severity: 'WARNING',
        currentValue: -65,
        threshold: -70,
        message: 'Signal recovered',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([clearDecision]);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertRecordRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should report alertsCleared equal to the number of CLEAR decisions that resolved', async () => {
      configureHappyPath(mocks);

      const activeRecord = WirelessAlertRecord.open(
        makeDeviceId(),
        'signal_rx_dbm',
        'WARNING',
        -70,
        -72,
        'test'
      ).value;
      mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
        Result.ok(activeRecord)
      );

      const clearDecision: AlertDecision = {
        metric: 'signal_rx_dbm',
        action: 'CLEAR',
        severity: 'WARNING',
        currentValue: -65,
        threshold: -70,
        message: 'Signal recovered',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([clearDecision]);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.alertsCleared).toBe(1);
    });

    it('should NOT call alertRecordRepo.save for CLEAR when active record is not found', async () => {
      configureHappyPath(mocks);
      mocks.alertRecordRepo.findActiveByDeviceMetricAndSeverity.mockResolvedValue(
        Result.ok(null)
      );

      const clearDecision: AlertDecision = {
        metric: 'signal_rx_dbm',
        action: 'CLEAR',
        severity: 'WARNING',
        currentValue: -65,
        threshold: -70,
        message: 'Signal recovered',
      };
      mocks.alertEvaluator.evaluate.mockReturnValue([clearDecision]);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.alertRecordRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — snapshot and config persistence', () => {
    it('should call snapshotRepo.save once on a successful poll', async () => {
      configureHappyPath(mocks);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.snapshotRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should call wirelessDeviceConfigRepo.save once to update lastPolledAt', async () => {
      configureHappyPath(mocks);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(mocks.wirelessDeviceConfigRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should log an error but still succeed when snapshotRepo.save fails', async () => {
      configureHappyPath(mocks);
      mocks.snapshotRepo.save.mockResolvedValue(Result.fail('Storage full'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('should log an error but still succeed when pollingConfigRepo.save fails', async () => {
      configureHappyPath(mocks);
      mocks.wirelessDeviceConfigRepo.save.mockResolvedValue(
        Result.fail('Concurrent modification')
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(mocks.logger.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    it('should return a successful Result', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should set metricsCollected to true', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.metricsCollected).toBe(true);
    });

    it('should echo the deviceId in the response', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include a valid ISO 8601 collectedAt string', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(new Date(result.value.collectedAt).toISOString()).toBe(
        result.value.collectedAt
      );
    });

    it('should report zero alertsTriggered and alertsCleared when evaluator returns no decisions', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.alertsTriggered).toBe(0);
      expect(result.value.alertsCleared).toBe(0);
    });

    it('should not set skipped on a successful poll', async () => {
      configureHappyPath(mocks);

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.skipped).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('executeImpl — metrics mapping', () => {
    it('should compute snrDb as signalRxDbm minus noiseFloorDbm when both are present', async () => {
      configureHappyPath(mocks);
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(makeHttpResult({ signalRxDbm: -65, noiseFloorDbm: -90 }))
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should pass cpuLoadPercent and memoryUsedPercent from HTTP result to metrics', async () => {
      configureHappyPath(mocks);
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(
          makeHttpResult({ cpuLoadPercent: 75, memoryUsedPercent: 80 })
        )
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(mocks.snapshotRepo.save).toHaveBeenCalledTimes(1);
    });
  });
  describe('[WLS-022] concurrent polls of the same device', () => {
    it('should skip a second poll while the first is still running', async () => {
      configureHappyPath(mocks);

      let releaseCollector: (v: unknown) => void = () => {};
      mocks.httpCollector.collect.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseCollector = () =>
              resolve(Result.ok(makeHttpResult()));
          })
      );

      const first = useCase.execute({ deviceId: VALID_DEVICE_UUID });
      const second = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(second.isSuccess).toBe(true);
      expect(second.value.skipped).toBe(true);
      expect(second.value.metricsCollected).toBe(false);
      expect(mocks.httpCollector.collect).toHaveBeenCalledTimes(1);

      releaseCollector(undefined);
      await first;
    });

    it('should allow a later poll once the first has finished', async () => {
      configureHappyPath(mocks);

      const first = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });
      const second = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(first.value.skipped).toBeUndefined();
      expect(second.value.skipped).toBeUndefined();
      expect(mocks.httpCollector.collect).toHaveBeenCalledTimes(2);
    });
  });

  describe('[WLS-051] remote access point linking', () => {
    it('should look the remote AP up by the MAC the radio reported', async () => {
      configureHappyPath(mocks);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(
        mocks.deviceRepo.findIdByMacAddress
      ).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
    });

    it('should store the resolved device id on the snapshot', async () => {
      configureHappyPath(mocks);
      const apId = DeviceId.parse(
        '550e8400-e29b-41d4-a716-4466554400ff'
      ).value;
      mocks.deviceRepo.findIdByMacAddress.mockResolvedValue(
        Result.ok(apId)
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.remoteApDeviceId).toBe(apId);
    });

    it('should leave the link null when the MAC matches no device', async () => {
      configureHappyPath(mocks);
      mocks.deviceRepo.findIdByMacAddress.mockResolvedValue(
        Result.ok(null)
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.remoteApDeviceId).toBeNull();
    });

    it('should not skip the lookup when the radio reports no remote AP MAC', async () => {
      configureHappyPath(mocks);
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(makeHttpResult({ remoteApMac: null }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(
        mocks.deviceRepo.findIdByMacAddress
      ).not.toHaveBeenCalled();
    });

    it('should still complete the poll when the AP lookup fails', async () => {
      configureHappyPath(mocks);
      mocks.deviceRepo.findIdByMacAddress.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.remoteApDeviceId).toBeNull();
    });
  });

  describe('[WLS-065] [WLS-066] client entries on the snapshot', () => {
    it('should store client entries for an ACCESS_POINT', async () => {
      configureHappyPath(mocks, { deviceType: 'ACCESS_POINT' });
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(makeHttpResult({ clients: [makeHttpClient()] }))
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.clients).toHaveLength(1);
      expect(saved.clients[0]!.macAddress).toBe('11:22:33:44:55:66');
    });

    it('should store no client entries for a STATION even when the radio reports them', async () => {
      configureHappyPath(mocks, { deviceType: 'STATION' });
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(makeHttpResult({ clients: [makeHttpClient()] }))
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.clients).toHaveLength(0);
    });

    it('should drop an invalid client entry and keep the valid ones', async () => {
      configureHappyPath(mocks, { deviceType: 'ACCESS_POINT' });
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(
          makeHttpResult({
            clients: [
              makeHttpClient({ macAddress: 'not-a-mac' }),
              makeHttpClient()
            ]
          })
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      const saved = mocks.snapshotRepo.save.mock.calls[0]![0];
      expect(saved.clients).toHaveLength(1);
      expect(saved.clients[0]!.macAddress).toBe('11:22:33:44:55:66');
    });
  });

  describe('[WLS-067] snapshot construction', () => {
    it('should build a snapshot even when every optional metric is null', async () => {
      configureHappyPath(mocks);
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(
          makeHttpResult({
            deviceName: null,
            firmwareVersion: null,
            uptimeSeconds: null,
            cpuLoadPercent: null,
            memoryUsedPercent: null,
            essid: null,
            frequencyMhz: null,
            channelWidthMhz: null,
            noiseFloorDbm: null,
            throughputTxBps: null,
            throughputRxBps: null,
            distanceM: null,
            signalRxDbm: null,
            latencyMs: null,
            remoteApMac: null,
            lanStatus: null,
            lanSpeedMbps: null
          })
        )
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(mocks.snapshotRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('[WLS-126] device name fallback', () => {
    it('should fall back to "Equipo desconocido" when the radio reports no hostname', async () => {
      configureHappyPath(mocks);
      mocks.httpCollector.collect.mockResolvedValue(
        Result.ok(makeHttpResult({ deviceName: null }))
      );

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const ctx = mocks.alertEvaluator.evaluate.mock.calls[0]![2];
      expect(ctx.deviceName).toBe('Equipo desconocido');
    });

    it('should use the reported hostname when there is one', async () => {
      configureHappyPath(mocks);

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const ctx = mocks.alertEvaluator.evaluate.mock.calls[0]![2];
      expect(ctx.deviceName).toBe('CPE-001');
    });
  });
});
