// Source: src/application/wireless-monitoring/mappers/WirelessSnapshotMapper.ts
import {
  WirelessSnapshot,
  WirelessMetrics,
  WirelessClientEntry,
  WirelessAlertRecord,
} from 'domain/wireless-monitoring';
import { DeviceId, SnapshotId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessSnapshotMapper } from 'application/wireless-monitoring/mappers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_UUID   = '550e8400-e29b-41d4-a716-446655440001';
const ALERT_UUID    = '550e8400-e29b-41d4-a716-446655440002';
const COLLECTED_AT  = new Date('2024-01-01T00:00:00.000Z');
const TRIGGERED_AT  = new Date('2024-01-01T01:00:00.000Z');
const CLEARED_AT    = new Date('2024-01-01T02:00:00.000Z');

function makeMetrics(
  overrides: Partial<{
    signalRxDbm:       number | null;
    signalTxDbm:       number | null;
    noiseFloorDbm:     number | null;
    snrDb:             number | null;
    ccqPercent:        number | null;
    txRateMbps:        number | null;
    rxRateMbps:        number | null;
    frequencyMhz:      number | null;
    channelWidthMhz:   number | null;
    txPowerDbm:        number | null;
    throughputTxBps:   number | null;
    throughputRxBps:   number | null;
    throughputTxPps:   number | null;
    throughputRxPps:   number | null;
    lanStatus:         'UP' | 'DOWN' | null;
    lanSpeedMbps:      number | null;
    lanDuplex:         'FULL' | 'HALF' | null;
    uptimeSeconds:     number | null;
    cpuLoadPercent:    number | null;
    memoryUsedPercent: number | null;
    firmwareVersion:   string | null;
    deviceName:        string | null;
    remoteApMac:       string | null;
    remoteApName:      string | null;
    distanceM:         number | null;
    latencyMs:         number | null;
    clientsConnected:  number | null;
    clientsProvisioned: number | null;
  }> = {}
): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    signalRxDbm:       -65,
    signalTxDbm:       -60,
    noiseFloorDbm:     -90,
    snrDb:             25,
    ccqPercent:        95,
    txRateMbps:        100,
    rxRateMbps:        80,
    frequencyMhz:      5180,
    channelWidthMhz:   40,
    txPowerDbm:        23,
    throughputTxBps:   10000000,
    throughputRxBps:   8000000,
    throughputTxPps:   1000,
    throughputRxPps:   800,
    lanStatus:         'UP',
    lanSpeedMbps:      1000,
    lanDuplex:         'FULL',
    uptimeSeconds:     86400,
    cpuLoadPercent:    30,
    memoryUsedPercent: 60,
    firmwareVersion:   'WA.v8.7.11',
    deviceName:        'CPE-001',
    remoteApMac:       'AA:BB:CC:DD:EE:FF',
    remoteApName:      'AP-001',
    distanceM:         500,
    latencyMs:         2,
    clientsConnected:  5,
    clientsProvisioned: 10,
    ...overrides,
  });
}

function makeNullMetrics(): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    signalRxDbm:       null,
    signalTxDbm:       null,
    noiseFloorDbm:     null,
    snrDb:             null,
    ccqPercent:        null,
    txRateMbps:        null,
    rxRateMbps:        null,
    frequencyMhz:      null,
    channelWidthMhz:   null,
    txPowerDbm:        null,
    throughputTxBps:   null,
    throughputRxBps:   null,
    throughputTxPps:   null,
    throughputRxPps:   null,
    lanStatus:         null,
    lanSpeedMbps:      null,
    lanDuplex:         null,
    uptimeSeconds:     null,
    cpuLoadPercent:    null,
    memoryUsedPercent: null,
    firmwareVersion:   null,
    deviceName:        null,
    remoteApMac:       null,
    remoteApName:      null,
    distanceM:         null,
    latencyMs:         null,
    clientsConnected:  null,
    clientsProvisioned: null,
  });
}

function makeSnapshot(
  overrides: Partial<{
    deviceId:         ReturnType<typeof DeviceId.parse>['value'];
    deviceType:       'STATION' | 'ACCESS_POINT';
    collectedAt:      Date;
    collectionMethod: 'snmp' | 'http_api' | 'mixed';
    metrics:          WirelessMetrics;
    clients:          WirelessClientEntry[];
    alerts:           [];
  }> = {}
): WirelessSnapshot {
  const id       = SnapshotId.parse(SNAPSHOT_UUID).value!;
  const deviceId = DeviceId.parse(DEVICE_UUID).value!;

  return WirelessSnapshot.reconstitute(
    id,
    {
      deviceId,
      deviceType:       'STATION',
      collectedAt:      COLLECTED_AT,
      collectionMethod: 'snmp',
      metrics:          makeMetrics(),
      clients:          [],
      alerts:           [],
      ...overrides,
    }
  );
}

function makeClient(
  overrides: Partial<{
    macAddress:      string;
    signalRxDbm:     number | null;
    signalTxDbm:     number | null;
    snrDb:           number | null;
    txRateMbps:      number | null;
    rxRateMbps:      number | null;
    throughputTxBps: number | null;
    throughputRxBps: number | null;
    ccqPercent:      number | null;
    uptimeSeconds:   number | null;
    ipAddress:       string | null;
  }> = {}
): WirelessClientEntry {
  return WirelessClientEntry.reconstitute({
    macAddress:      'AA:BB:CC:DD:EE:FF',
    signalRxDbm:     -68,
    signalTxDbm:     -65,
    snrDb:           22,
    txRateMbps:      54,
    rxRateMbps:      48,
    throughputTxBps: 5000000,
    throughputRxBps: 4000000,
    ccqPercent:      90,
    uptimeSeconds:   3600,
    ipAddress:       '192.168.1.10',
    ...overrides,
  });
}

function makeAlertRecord(
  overrides: Partial<{
    deviceId:    ReturnType<typeof DeviceId.parse>['value'];
    severity:    'WARNING' | 'CRITICAL';
    metric:      string;
    threshold:   number;
    lastValue:   number;
    message:     string;
    triggeredAt: Date;
    clearedAt:   Date | null;
    isActive:    boolean;
  }> = {}
): WirelessAlertRecord {
  const id       = WirelessAlertRecordId.parse(ALERT_UUID).value!;
  const deviceId = DeviceId.parse(DEVICE_UUID).value!;

  return WirelessAlertRecord.reconstitute(
    id,
    {
      deviceId,
      metric:      'signalRxDbm',
      severity:    'WARNING',
      threshold:   -70,
      lastValue:   -75,
      message:     'Signal below threshold',
      triggeredAt: TRIGGERED_AT,
      clearedAt:   null,
      isActive:    true,
      ...overrides,
    }
  );
}

// ---------------------------------------------------------------------------

describe('WirelessSnapshotMapper', () => {
  describe('toStatusDTO()', () => {
    // =========================================================================
    describe('root fields', () => {
      it('should map deviceId to a string', () => {
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should pass deviceType CPE through unchanged', () => {
        const snapshot = makeSnapshot({ deviceType: 'STATION' });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.deviceType).toBe('STATION');
      });

      it('should pass deviceType ACCESS_POINT through unchanged', () => {
        const snapshot = makeSnapshot({ deviceType: 'ACCESS_POINT' });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.deviceType).toBe('ACCESS_POINT');
      });

      it('should map collectedAt to an ISO string', () => {
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.collectedAt).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should pass collectionMethod snmp through unchanged', () => {
        const snapshot = makeSnapshot({ collectionMethod: 'snmp' });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.collectionMethod).toBe('snmp');
      });

      it('should pass collectionMethod http_api through unchanged', () => {
        const snapshot = makeSnapshot({ collectionMethod: 'http_api' });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.collectionMethod).toBe('http_api');
      });

      it('should pass collectionMethod mixed through unchanged', () => {
        const snapshot = makeSnapshot({ collectionMethod: 'mixed' });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.collectionMethod).toBe('mixed');
      });
    });

    // =========================================================================
    describe('metrics mapping', () => {
      it('should map signalRxDbm from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ signalRxDbm: -65 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.signalRxDbm).toBe(-65);
      });

      it('should map signalTxDbm from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ signalTxDbm: -60 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.signalTxDbm).toBe(-60);
      });

      it('should map noiseFloorDbm from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ noiseFloorDbm: -90 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.noiseFloorDbm).toBe(-90);
      });

      it('should map snrDb from the stored getter, not getSnr()', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ snrDb: 25 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.snrDb).toBe(25);
      });

      it('should map snrDb as null when stored snrDb is null even when signal and noise are present', () => {
        const snapshot = makeSnapshot({
          metrics: makeMetrics({ snrDb: null, signalRxDbm: -65, noiseFloorDbm: -90 }),
        });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.snrDb).toBeNull();
      });

      it('should map ccqPercent from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ ccqPercent: 95 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.ccqPercent).toBe(95);
      });

      it('should map txRateMbps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ txRateMbps: 100 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.txRateMbps).toBe(100);
      });

      it('should map rxRateMbps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ rxRateMbps: 80 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.rxRateMbps).toBe(80);
      });

      it('should map frequencyMhz from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ frequencyMhz: 5180 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.frequencyMhz).toBe(5180);
      });

      it('should map channelWidthMhz from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ channelWidthMhz: 40 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.channelWidthMhz).toBe(40);
      });

      it('should map txPowerDbm from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ txPowerDbm: 23 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.txPowerDbm).toBe(23);
      });

      it('should map throughputTxBps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ throughputTxBps: 10000000 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputTxBps).toBe(10000000);
      });

      it('should map throughputRxBps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ throughputRxBps: 8000000 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputRxBps).toBe(8000000);
      });

      it('should map throughputTxPps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ throughputTxPps: 1000 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputTxPps).toBe(1000);
      });

      it('should map throughputRxPps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ throughputRxPps: 800 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputRxPps).toBe(800);
      });

      it('should map lanStatus UP from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ lanStatus: 'UP' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanStatus).toBe('UP');
      });

      it('should map lanStatus DOWN from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ lanStatus: 'DOWN' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanStatus).toBe('DOWN');
      });

      it('should map lanSpeedMbps from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ lanSpeedMbps: 1000 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanSpeedMbps).toBe(1000);
      });

      it('should map lanDuplex FULL from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ lanDuplex: 'FULL' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanDuplex).toBe('FULL');
      });

      it('should map lanDuplex HALF from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ lanDuplex: 'HALF' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanDuplex).toBe('HALF');
      });

      it('should map uptimeSeconds from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ uptimeSeconds: 86400 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.uptimeSeconds).toBe(86400);
      });

      it('should map cpuLoadPercent from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ cpuLoadPercent: 30 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.cpuLoadPercent).toBe(30);
      });

      it('should map memoryUsedPercent from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ memoryUsedPercent: 60 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.memoryUsedPercent).toBe(60);
      });

      it('should map firmwareVersion from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ firmwareVersion: 'WA.v8.7.11' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.firmwareVersion).toBe('WA.v8.7.11');
      });

      it('should map deviceName from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ deviceName: 'CPE-001' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.deviceName).toBe('CPE-001');
      });

      it('should map remoteApMac from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ remoteApMac: 'AA:BB:CC:DD:EE:FF' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.remoteApMac).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should map remoteApName from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ remoteApName: 'AP-001' }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.remoteApName).toBe('AP-001');
      });

      it('should map distanceM from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ distanceM: 500 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.distanceM).toBe(500);
      });

      it('should map latencyMs from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ latencyMs: 2 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.latencyMs).toBe(2);
      });

      it('should map clientsConnected from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ clientsConnected: 5 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.clientsConnected).toBe(5);
      });

      it('should map clientsProvisioned from the metrics value object', () => {
        const snapshot = makeSnapshot({ metrics: makeMetrics({ clientsProvisioned: 10 }) });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.clientsProvisioned).toBe(10);
      });
    });

    // =========================================================================
    describe('null metrics fields', () => {
      it('should pass signalRxDbm as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.signalRxDbm).toStrictEqual(null);
      });

      it('should pass signalTxDbm as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.signalTxDbm).toStrictEqual(null);
      });

      it('should pass noiseFloorDbm as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.noiseFloorDbm).toStrictEqual(null);
      });

      it('should pass snrDb as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.snrDb).toStrictEqual(null);
      });

      it('should pass lanStatus as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanStatus).toStrictEqual(null);
      });

      it('should pass lanDuplex as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.lanDuplex).toStrictEqual(null);
      });

      it('should pass firmwareVersion as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.firmwareVersion).toStrictEqual(null);
      });

      it('should pass remoteApMac as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.remoteApMac).toStrictEqual(null);
      });

      it('should pass throughputTxBps as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputTxBps).toStrictEqual(null);
      });

      it('should pass throughputRxBps as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputRxBps).toStrictEqual(null);
      });

      it('should pass throughputTxPps as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputTxPps).toStrictEqual(null);
      });

      it('should pass throughputRxPps as strictly null when not set', () => {
        const snapshot = makeSnapshot({ metrics: makeNullMetrics() });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.metrics.throughputRxPps).toStrictEqual(null);
      });
    });

    // =========================================================================
    describe('activeAlerts mapping', () => {
      it('should produce an empty activeAlerts array when no alerts are passed', () => {
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.activeAlerts).toHaveLength(0);
      });

      it('should map one alert id to a string', () => {
        const alert    = makeAlertRecord();
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].id).toBe(ALERT_UUID);
      });

      it('should map one alert deviceId to a string', () => {
        const alert    = makeAlertRecord();
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].deviceId).toBe(DEVICE_UUID);
      });

      it('should map one alert severity correctly', () => {
        const alert    = makeAlertRecord({ severity: 'WARNING' });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].severity).toBe('WARNING');
      });

      it('should map one alert severity CRITICAL correctly', () => {
        const alert    = makeAlertRecord({ severity: 'CRITICAL' });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].severity).toBe('CRITICAL');
      });

      it('should map one alert triggeredAt to an ISO string', () => {
        const alert    = makeAlertRecord();
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].triggeredAt).toBe('2024-01-01T01:00:00.000Z');
      });

      it('should map one alert clearedAt to null when not set', () => {
        const alert    = makeAlertRecord({ clearedAt: null });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].clearedAt).toBeNull();
      });

      it('should map one alert clearedAt to an ISO string when set', () => {
        const alert    = makeAlertRecord({ clearedAt: CLEARED_AT, isActive: false });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert]);

        expect(dto.activeAlerts[0].clearedAt).toBe('2024-01-01T02:00:00.000Z');
      });

      it('should map multiple alerts and preserve their count', () => {
        const alert1   = makeAlertRecord({ severity: 'WARNING' });
        const alert2   = makeAlertRecord({ severity: 'CRITICAL' });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert1, alert2]);

        expect(dto.activeAlerts).toHaveLength(2);
      });

      it('should preserve alert ordering across multiple alerts', () => {
        const alert1   = makeAlertRecord({ metric: 'signalRxDbm' });
        const alert2   = makeAlertRecord({ metric: 'cpuLoadPercent' });
        const snapshot = makeSnapshot();

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, [alert1, alert2]);

        expect(dto.activeAlerts[0].metric).toBe('signalRxDbm');
        expect(dto.activeAlerts[1].metric).toBe('cpuLoadPercent');
      });
    });

    // =========================================================================
    describe('clients mapping', () => {
      it('should produce an empty clients array when snapshot has no clients', () => {
        const snapshot = makeSnapshot({ clients: [] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients).toHaveLength(0);
      });

      it('should map one client macAddress correctly', () => {
        const client   = makeClient({ macAddress: 'AA:BB:CC:DD:EE:FF' });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should map one client signalRxDbm correctly', () => {
        const client   = makeClient({ signalRxDbm: -68 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].signalRxDbm).toBe(-68);
      });

      it('should map one client signalTxDbm correctly', () => {
        const client   = makeClient({ signalTxDbm: -65 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].signalTxDbm).toBe(-65);
      });

      it('should map one client snrDb correctly', () => {
        const client   = makeClient({ snrDb: 22 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].snrDb).toBe(22);
      });

      it('should map one client txRateMbps correctly', () => {
        const client   = makeClient({ txRateMbps: 54 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].txRateMbps).toBe(54);
      });

      it('should map one client rxRateMbps correctly', () => {
        const client   = makeClient({ rxRateMbps: 48 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].rxRateMbps).toBe(48);
      });

      it('should map one client throughputTxBps correctly', () => {
        const client   = makeClient({ throughputTxBps: 5000000 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].throughputTxBps).toBe(5000000);
      });

      it('should map one client throughputRxBps correctly', () => {
        const client   = makeClient({ throughputRxBps: 4000000 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].throughputRxBps).toBe(4000000);
      });

      it('should map one client ccqPercent correctly', () => {
        const client   = makeClient({ ccqPercent: 90 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].ccqPercent).toBe(90);
      });

      it('should map one client uptimeSeconds correctly', () => {
        const client   = makeClient({ uptimeSeconds: 3600 });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].uptimeSeconds).toBe(3600);
      });

      it('should map one client ipAddress correctly when present', () => {
        const client   = makeClient({ ipAddress: '192.168.1.10' });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].ipAddress).toBe('192.168.1.10');
      });

      it('should map one client ipAddress as strictly null when not set', () => {
        const client   = makeClient({ ipAddress: null });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].ipAddress).toStrictEqual(null);
      });

      it('should map one client signalRxDbm as strictly null when not set', () => {
        const client   = makeClient({ signalRxDbm: null });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].signalRxDbm).toStrictEqual(null);
      });

      it('should map one client throughputTxBps as strictly null when not set', () => {
        const client   = makeClient({ throughputTxBps: null });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].throughputTxBps).toStrictEqual(null);
      });

      it('should map one client throughputRxBps as strictly null when not set', () => {
        const client   = makeClient({ throughputRxBps: null });
        const snapshot = makeSnapshot({ clients: [client] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].throughputRxBps).toStrictEqual(null);
      });

      it('should map multiple clients and preserve their count', () => {
        const client1  = makeClient({ macAddress: 'AA:BB:CC:DD:EE:FF' });
        const client2  = makeClient({ macAddress: '11:22:33:44:55:66' });
        const snapshot = makeSnapshot({ clients: [client1, client2] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients).toHaveLength(2);
      });

      it('should preserve client ordering across multiple clients', () => {
        const client1  = makeClient({ macAddress: 'AA:BB:CC:DD:EE:FF' });
        const client2  = makeClient({ macAddress: '11:22:33:44:55:66' });
        const snapshot = makeSnapshot({ clients: [client1, client2] });

        const dto = WirelessSnapshotMapper.toStatusDTO(snapshot, []);

        expect(dto.clients[0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
        expect(dto.clients[1].macAddress).toBe('11:22:33:44:55:66');
      });
    });
  });
});
