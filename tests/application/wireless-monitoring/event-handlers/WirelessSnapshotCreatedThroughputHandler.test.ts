// Source: src/application/wireless-monitoring/event-handlers/WirelessSnapshotCreatedThroughputHandler.ts

import { WirelessSnapshotCreatedThroughputHandler } from '../../../../src/application/wireless-monitoring/event-handlers/WirelessSnapshotCreatedThroughputHandler';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import {
  ILogger,
  IEventStreamHub
} from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import { WirelessSnapshotCreatedEvent } from '../../../../src/domain/wireless-monitoring/events';
import {
  WirelessSnapshot,
  WirelessDeviceConfig
} from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import {
  DeviceId,
  SnapshotId,
  WirelessDeviceConfigId
} from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440003';

const DEVICE_CHANNEL = `throughput:device:${DEVICE_UUID}`;
const FLEET_CHANNEL = 'throughput:fleet';

// ---------------------------------------------------------------------------
// Helpers
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

function makeSnapshot(): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(SNAPSHOT_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      deviceType: 'STATION',
      collectedAt: new Date(),
      collectionMethod: 'http_api',
      metrics: WirelessMetrics.reconstitute({
        signalRxDbm: null,
        signalTxDbm: null,
        noiseFloorDbm: null,
        snrDb: null,
        ccqPercent: null,
        frequencyMhz: null,
        channelWidthMhz: null,
        throughputTxBps: 4_000_000,
        throughputRxBps: 1_000_000,
        throughputTxPps: null,
        throughputRxPps: null,
        lanStatus: null,
        lanSpeedMbps: null,
        lanDuplex: null,
        uptimeSeconds: null,
        cpuLoadPercent: null,
        memoryUsedPercent: null,
        firmwareVersion: null,
        deviceName: null,
        remoteApMac: null,
        remoteApName: null,
        remoteApIp: null,
        distanceM: null,
        latencyMs: null,
        capacityTxKbps: null,
        capacityRxKbps: null,
        deviceTimeEpoch: null,
        clientsConnected: null,
        macAddress: null,
        deviceModel: null,
        ssid: null
      }),
      clients: [],
      alerts: [],
      remoteApDeviceId: null
    }
  );
}

function makeConfig(): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps: 10_000,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      lastPolledAt: null
    }
  );
}

function makeEvent(): WirelessSnapshotCreatedEvent {
  return new WirelessSnapshotCreatedEvent({
    aggregateId: SnapshotId.parse(SNAPSHOT_UUID).value,
    deviceId: DeviceId.parse(DEVICE_UUID).value,
    deviceType: 'STATION',
    collectedAt: new Date(),
    dateTimeOccurred: new Date()
  });
}

// ---------------------------------------------------------------------------

describe('[WLS-146] WirelessSnapshotCreatedThroughputHandler', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let configRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let hub: jest.Mocked<IEventStreamHub>;
  let logger: jest.Mocked<ILogger>;
  let handler: WirelessSnapshotCreatedThroughputHandler;

  beforeEach(() => {
    snapshotRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findLatestByDevice: jest.fn(),
      findLatestForAllDevices: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteOlderThan: jest.fn()
    };

    configRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      findByDeviceId: jest.fn(),
      findAllDue: jest.fn(),
      findAll: jest.fn()
    };

    hub = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      clientCount: jest.fn().mockReturnValue(1),
      closeAll: jest.fn()
    };

    logger = makeLogger();
    handler = new WirelessSnapshotCreatedThroughputHandler(
      snapshotRepo,
      configRepo,
      hub,
      logger
    );
  });

  it('publishes the reading to both the device and fleet channels', async () => {
    snapshotRepo.findById.mockResolvedValue(
      Result.ok(makeSnapshot())
    );
    configRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeConfig())
    );

    await handler.handle(makeEvent());

    expect(hub.publish).toHaveBeenCalledTimes(2);

    const [deviceCall, fleetCall] = hub.publish.mock.calls;
    expect(deviceCall[0]).toBe(DEVICE_CHANNEL);
    expect(deviceCall[1]).toBe('throughput');
    expect(fleetCall[0]).toBe(FLEET_CHANNEL);
    expect(fleetCall[1]).toBe('throughput');

    // the same payload on both channels — a fleet subscriber receives deltas
    expect(deviceCall[2]).toEqual(fleetCall[2]);
    expect(deviceCall[2]).toMatchObject({
      deviceId: DEVICE_UUID,
      throughputTotalBps: 5_000_000,
      utilisationPercent: 50
    });
  });

  // polling a fleet must not pay for a feature nobody has open
  describe('with no subscribers', () => {
    it('skips the repository reads entirely', async () => {
      hub.clientCount.mockReturnValue(0);

      await handler.handle(makeEvent());

      expect(snapshotRepo.findById).not.toHaveBeenCalled();
      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
      expect(hub.publish).not.toHaveBeenCalled();
    });

    it('still works when only the fleet channel is subscribed', async () => {
      hub.clientCount.mockImplementation((channel?: string) =>
        channel === FLEET_CHANNEL ? 1 : 0
      );
      snapshotRepo.findById.mockResolvedValue(
        Result.ok(makeSnapshot())
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );

      await handler.handle(makeEvent());

      expect(hub.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('failures never reach the poll', () => {
    it('logs and returns when the snapshot cannot be read', async () => {
      snapshotRepo.findById.mockResolvedValue(
        Result.fail('connection reset')
      );

      await expect(
        handler.handle(makeEvent())
      ).resolves.not.toThrow();

      expect(hub.publish).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('logs and returns when the snapshot has vanished', async () => {
      snapshotRepo.findById.mockResolvedValue(Result.ok(null));

      await handler.handle(makeEvent());

      expect(hub.publish).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('logs and returns when the config cannot be read', async () => {
      snapshotRepo.findById.mockResolvedValue(
        Result.ok(makeSnapshot())
      );
      configRepo.findByDeviceId.mockResolvedValue(
        Result.fail('connection reset')
      );

      await handler.handle(makeEvent());

      expect(hub.publish).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('swallows an unexpected throw', async () => {
      snapshotRepo.findById.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(makeEvent())
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
