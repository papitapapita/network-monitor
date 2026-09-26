import { LinkDiagnosisSession } from '../../../../src/application/wireless-monitoring/services/LinkDiagnosisSession';
import {
  LinkDiagnosisTarget,
  WirelessCollectionResult,
  IWirelessCollector
} from '../../../../src/application/wireless-monitoring/interfaces';
import { WirelessAlertEvaluator } from '../../../../src/domain/wireless-monitoring/services/WirelessAlertEvaluator';
import { LinkDiagnosisAnalyzer } from '../../../../src/domain/wireless-monitoring/services/LinkDiagnosisAnalyzer';
import { SignalStrengthRule } from '../../../../src/domain/wireless-monitoring/services/rules/SignalStrengthRule';
import { ThroughputSaturationRule } from '../../../../src/domain/wireless-monitoring/services/rules/ThroughputSaturationRule';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const T0 = new Date('2026-09-26T10:00:00.000Z');

function at(seconds: number): Date {
  return new Date(T0.getTime() + seconds * 1000);
}

function makeTarget(
  overrides: Partial<LinkDiagnosisTarget> = {}
): LinkDiagnosisTarget {
  return {
    deviceId: DEVICE_UUID,
    deviceType: 'STATION',
    ipAddress: '10.0.0.20',
    parent: { deviceId: null, ipAddress: '10.0.0.1' },
    collector: {} as IWirelessCollector,
    credentials: {
      httpUsername: 'ubnt',
      httpPassword: 'secret',
      snmpCommunity: null,
      snmpPort: 161,
      httpPort: 443
    } as LinkDiagnosisTarget['credentials'],
    durationSeconds: 60,
    linkCapacityKbps: 10_000,
    clientsProvisionedLimit: null,
    provisionedLanSpeedMbps: null,
    ...overrides
  };
}

function makeCollected(
  overrides: Partial<WirelessCollectionResult> = {}
): WirelessCollectionResult {
  return {
    deviceName: 'CPE-Juan',
    firmwareVersion: 'WA.v8.7.11',
    uptimeSeconds: 1000,
    deviceTimeEpoch: null,
    cpuLoadPercent: 10,
    memoryUsedPercent: 40,
    essid: 'ISP',
    mode: 'sta-ptmp',
    frequencyMhz: 5180,
    channelWidthMhz: 20,
    noiseFloorDbm: -95,
    throughputTxBps: 1_000_000,
    throughputRxBps: 2_000_000,
    wirelessTxBytes: null,
    wirelessRxBytes: null,
    distanceM: 800,
    clientsConnected: null,
    ccqPercent: 95,
    signalRxDbm: -60,
    signalTxDbm: -62,
    latencyMs: 2,
    remoteApMac: 'AA:BB:CC:DD:EE:FF',
    remoteApName: 'AP-Norte',
    remoteApIp: '10.0.0.1',
    capacityTxKbps: 50_000,
    capacityRxKbps: 60_000,
    lanStatus: 'UP',
    lanSpeedMbps: 100,
    macAddress: '11:22:33:44:55:66',
    deviceModel: 'LiteBeam 5AC',
    clients: [],
    ...overrides
  };
}

function makeSession(
  target: LinkDiagnosisTarget = makeTarget()
): LinkDiagnosisSession {
  return new LinkDiagnosisSession(
    target,
    T0,
    new WirelessAlertEvaluator([
      new SignalStrengthRule(),
      new ThroughputSaturationRule()
    ]),
    new LinkDiagnosisAnalyzer()
  );
}

describe('LinkDiagnosisSession', () => {
  describe('[WLS-181] lifecycle', () => {
    it('should end at start plus the duration', () => {
      const session = makeSession();

      expect(session.endsAt).toEqual(at(60));
      expect(session.isRunning).toBe(true);
    });

    it('should drop samples recorded after it finished', () => {
      const session = makeSession();
      session.finish('STOPPED', at(5));

      expect(session.recordPing('TARGET', 3, at(6))).toBeNull();
      expect(session.recordRadio(makeCollected(), at(6))).toBeNull();
      expect(session.recordRadioFailure('x', at(6))).toBeNull();
      expect(session.report(at(7)).target.sent).toBe(0);
    });

    it('should keep the first end status when finished twice', () => {
      const session = makeSession();
      session.finish('STOPPED', at(5));
      session.finish('COMPLETED', at(60));

      const dto = session.toDTO(at(61), false);
      expect(dto.status).toBe('STOPPED');
      expect(dto.endedAt).toBe(at(5).toISOString());
    });
  });

  describe('[WLS-187] ping statistics per hop', () => {
    it('should keep target and parent replies apart', () => {
      const session = makeSession();
      session.recordPing('TARGET', 4, at(1));
      session.recordPing('TARGET', null, at(2));
      session.recordPing('PARENT', 2, at(1));

      const report = session.report(at(3));
      expect(report.target).toMatchObject({ sent: 2, received: 1 });
      expect(report.parent).toMatchObject({ sent: 1, received: 1 });
    });

    it('should report no parent statistics when no parent hop exists', () => {
      const session = makeSession(makeTarget({ parent: null }));
      session.recordPing('TARGET', 4, at(1));

      expect(session.report(at(2)).parent).toBeNull();
    });
  });

  describe('[WLS-185] live throughput', () => {
    it('should fall back to the firmware figure when counters are missing', () => {
      const session = makeSession();

      const sample = session.recordRadio(makeCollected(), at(2));

      expect(sample).toMatchObject({
        ok: true,
        throughputTxBps: 1_000_000,
        throughputRxBps: 2_000_000
      });
    });

    it('should derive the rate from counter deltas between samples', () => {
      const session = makeSession();
      session.recordRadio(
        makeCollected({ wirelessTxBytes: 0n, wirelessRxBytes: 0n }),
        at(0)
      );

      // 500 000 bytes in 2 s = 2 Mbps; 1 250 000 bytes in 2 s = 5 Mbps
      const sample = session.recordRadio(
        makeCollected({
          wirelessTxBytes: 500_000n,
          wirelessRxBytes: 1_250_000n
        }),
        at(2)
      );

      expect(sample?.throughputTxBps).toBe(2_000_000);
      expect(sample?.throughputRxBps).toBe(5_000_000);
    });

    it('should fall back when a counter goes backwards', () => {
      const session = makeSession();
      session.recordRadio(
        makeCollected({
          wirelessTxBytes: 9_000_000n,
          wirelessRxBytes: 9_000_000n
        }),
        at(0)
      );

      const sample = session.recordRadio(
        makeCollected({ wirelessTxBytes: 10n, wirelessRxBytes: 10n }),
        at(2)
      );

      expect(sample?.throughputTxBps).toBe(1_000_000);
    });

    it('should summarise average and peak throughput', () => {
      const session = makeSession();
      session.recordRadio(
        makeCollected({
          throughputTxBps: 1_000,
          throughputRxBps: 3_000
        }),
        at(0)
      );
      session.recordRadio(
        makeCollected({
          throughputTxBps: 3_000,
          throughputRxBps: 5_000
        }),
        at(2)
      );
      session.recordRadioFailure('timeout', at(4));

      expect(session.report(at(5)).radio).toEqual({
        samples: 2,
        failures: 1,
        throughput: {
          avgTxBps: 2_000,
          avgRxBps: 4_000,
          peakTxBps: 3_000,
          peakRxBps: 5_000,
          linkCapacityKbps: 10_000
        }
      });
    });
  });

  describe('[WLS-188] radio findings', () => {
    it('should turn a persistent weak signal into a finding', () => {
      const session = makeSession();
      for (let i = 0; i < 3; i++) {
        session.recordPing('TARGET', 3, at(i));
        session.recordPing('PARENT', 2, at(i));
        session.recordRadio(
          makeCollected({ signalRxDbm: -74 }),
          at(i)
        );
      }

      const report = session.report(at(4));

      expect(report.findings).toEqual([
        expect.objectContaining({
          code: 'signal_rx_dbm',
          hop: 'RADIO',
          severity: 'WARNING'
        })
      ]);
      expect(report.faultLocation).toBe('TARGET_LINK');
      expect(report.findings[0]!.message).toContain('CPE-Juan');
    });

    it('should flag saturation from the live counter rate', () => {
      const session = makeSession();
      session.recordPing('TARGET', 3, at(0));
      session.recordPing('TARGET', 3, at(1));
      session.recordPing('TARGET', 3, at(2));
      session.recordRadio(
        makeCollected({
          throughputTxBps: 0,
          throughputRxBps: 0,
          wirelessTxBytes: 0n,
          wirelessRxBytes: 0n
        }),
        at(0)
      );
      // 2 250 000 bytes each way in 2 s = 9 Mbps each, 18 Mbps on a 10 Mbps link
      session.recordRadio(
        makeCollected({
          throughputTxBps: 0,
          throughputRxBps: 0,
          wirelessTxBytes: 2_250_000n,
          wirelessRxBytes: 2_250_000n
        }),
        at(2)
      );

      const codes = session.report(at(3)).findings.map((f) => f.code);
      expect(codes).toContain('throughput_saturation');
    });

    it('should count a radio read failure without a finding while pings are fine', () => {
      const session = makeSession();
      session.recordRadioFailure('HTTP 500', at(0));

      const sample = session.toDTO(at(1), true).samples!.radio[0]!;
      expect(sample).toMatchObject({ ok: false, error: 'HTTP 500' });
    });
  });

  describe('toDTO', () => {
    it('should learn the device and parent names from the radio', () => {
      const session = makeSession();
      session.recordRadio(makeCollected(), at(0));

      const dto = session.toDTO(at(1), false);

      expect(dto.target).toEqual({
        deviceId: DEVICE_UUID,
        ipAddress: '10.0.0.20',
        name: 'CPE-Juan'
      });
      expect(dto.parent).toEqual({
        deviceId: null,
        ipAddress: '10.0.0.1',
        name: 'AP-Norte'
      });
    });

    it('should include samples only when asked', () => {
      const session = makeSession();
      session.recordPing('TARGET', 3, at(0));

      expect(session.toDTO(at(1), false).samples).toBeUndefined();
      expect(session.toDTO(at(1), true).samples?.ping).toEqual([
        { hop: 'TARGET', at: at(0).toISOString(), latencyMs: 3 }
      ]);
    });

    it('should never expose the credentials', () => {
      const session = makeSession();

      expect(
        JSON.stringify(session.toDTO(at(1), true))
      ).not.toContain('secret');
    });

    it('should date the report of a finished session at its end', () => {
      const session = makeSession();
      session.finish('COMPLETED', at(60));

      expect(session.toDTO(at(500), false).report.generatedAt).toBe(
        at(60).toISOString()
      );
    });
  });
});
