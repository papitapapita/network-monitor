// Source: src/domain/wireless-monitoring/services/rules/IdentityChangeRule.ts

import { IdentityChangeRule } from '../../../../../src/domain/wireless-monitoring/services/rules/IdentityChangeRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeNullProps(): WirelessMetricsProps {
  return {
    signalRxDbm: null,
    signalTxDbm: null,
    noiseFloorDbm: null,
    snrDb: null,
    ccqPercent: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    throughputTxBps: null,
    throughputRxBps: null,
    lanStatus: null,
    lanSpeedMbps: null,
    lanDuplex: null,
    uptimeSeconds: null,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
    clientsConnected: null,
    throughputTxPps: null,
    throughputRxPps: null,
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
    macAddress: null,
    deviceModel: null,
    ssid: null
  };
}

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.create({ ...makeNullProps(), ...overrides })
    .value;
}

function makeContext(
  overrides: Partial<EvaluationContext> = {}
): EvaluationContext {
  return {
    deviceName: 'CPE-001',
    deviceModel: null,
    linkCapacityKbps: null,
    clientsProvisionedLimit: null,
    previousMetrics: null,
    collectedAt: new Date(),
    ...overrides
  };
}

function makeActiveAlert(
  metric: string,
  severity: 'WARNING' | 'CRITICAL' = 'WARNING'
): WirelessAlertRecord {
  return WirelessAlertRecord.open(
    DeviceId.parse(DEVICE_UUID).value,
    metric,
    severity,
    -70,
    -72,
    'test'
  ).value;
}

function activeMap(
  ...entries: Array<[string, 'WARNING' | 'CRITICAL']>
): Map<string, WirelessAlertRecord> {
  const m = new Map<string, WirelessAlertRecord>();
  for (const [metric, sev] of entries) {
    m.set(`${metric}:${sev}`, makeActiveAlert(metric, sev));
  }
  return m;
}

describe('[WLS-098] IdentityChangeRule', () => {
  let rule: IdentityChangeRule;

  beforeEach(() => {
    rule = new IdentityChangeRule();
  });

  describe('guard: previousMetrics', () => {
    it('should return [] when previousMetrics is null, even if current values are present', () => {
      const metrics = makeMetrics({
        ssid: 'Network-A',
        macAddress: '00:11:22:33:44:55',
        deviceModel: 'Rocket M5'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: null }),
        new Map()
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('ssid_changed', () => {
    it('should return [] when current ssid is null', () => {
      const prev = makeMetrics({ ssid: 'Network-A' });
      const metrics = makeMetrics({ ssid: null });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'ssid_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous ssid is null', () => {
      const prev = makeMetrics({ ssid: null });
      const metrics = makeMetrics({ ssid: 'Network-B' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'ssid_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when ssid changes and no active alert', () => {
      const prev = makeMetrics({ ssid: 'Network-A' });
      const metrics = makeMetrics({ ssid: 'Network-B' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) => d.metric === 'ssid_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(1);
      expect(decision!.threshold).toBe(0);
    });

    it('should include the old and new ssid values in the OPEN message', () => {
      const prev = makeMetrics({ ssid: 'Network-A' });
      const metrics = makeMetrics({ ssid: 'Network-B' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) => d.metric === 'ssid_changed' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
      expect(decision!.message).toContain('"Network-A"');
      expect(decision!.message).toContain('"Network-B"');
      expect(decision!.message).toContain('→');
    });

    it('should emit CLEAR WARNING when ssid matches previous and active alert exists', () => {
      const prev = makeMetrics({ ssid: 'Network-A' });
      const metrics = makeMetrics({ ssid: 'Network-A' });
      const alerts = activeMap(['ssid_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const decision = result.find(
        (d) => d.metric === 'ssid_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when ssid_changed alert is already active', () => {
      const prev = makeMetrics({ ssid: 'Network-A' });
      const metrics = makeMetrics({ ssid: 'Network-B' });
      const alerts = activeMap(['ssid_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const opens = result.filter(
        (d) => d.metric === 'ssid_changed' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('mac_address_changed', () => {
    it('should return [] when current macAddress is null', () => {
      const prev = makeMetrics({ macAddress: '00:11:22:33:44:55' });
      const metrics = makeMetrics({ macAddress: null });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'mac_address_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous macAddress is null', () => {
      const prev = makeMetrics({ macAddress: null });
      const metrics = makeMetrics({
        macAddress: '00:11:22:33:44:66'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'mac_address_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when macAddress changes and no active alert', () => {
      const prev = makeMetrics({ macAddress: '00:11:22:33:44:55' });
      const metrics = makeMetrics({
        macAddress: '00:11:22:33:44:66'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) => d.metric === 'mac_address_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
    });

    it('should include the old and new MAC values in the OPEN message', () => {
      const prev = makeMetrics({ macAddress: '00:11:22:33:44:55' });
      const metrics = makeMetrics({
        macAddress: '00:11:22:33:44:66'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) =>
          d.metric === 'mac_address_changed' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
      expect(decision!.message).toContain('→');
    });

    it('should emit CLEAR WARNING when macAddress matches previous and active alert exists', () => {
      const prev = makeMetrics({ macAddress: '00:11:22:33:44:55' });
      const metrics = makeMetrics({
        macAddress: '00:11:22:33:44:55'
      });
      const alerts = activeMap(['mac_address_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const decision = result.find(
        (d) => d.metric === 'mac_address_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when mac_address_changed alert is already active', () => {
      const prev = makeMetrics({ macAddress: '00:11:22:33:44:55' });
      const metrics = makeMetrics({
        macAddress: '00:11:22:33:44:66'
      });
      const alerts = activeMap(['mac_address_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const opens = result.filter(
        (d) =>
          d.metric === 'mac_address_changed' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('device_model_changed', () => {
    it('should return [] when current deviceModel is null', () => {
      const prev = makeMetrics({ deviceModel: 'Rocket M5' });
      const metrics = makeMetrics({ deviceModel: null });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'device_model_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous deviceModel is null', () => {
      const prev = makeMetrics({ deviceModel: null });
      const metrics = makeMetrics({ deviceModel: 'Rocket M5' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'device_model_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when deviceModel changes and no active alert', () => {
      const prev = makeMetrics({ deviceModel: 'Rocket M5' });
      const metrics = makeMetrics({ deviceModel: 'NanoStation M2' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) => d.metric === 'device_model_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
    });

    it('should include the old and new device model values in the OPEN message', () => {
      const prev = makeMetrics({ deviceModel: 'Rocket M5' });
      const metrics = makeMetrics({ deviceModel: 'NanoStation M2' });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) =>
          d.metric === 'device_model_changed' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
      expect(decision!.message).toContain('"Rocket M5"');
      expect(decision!.message).toContain('"NanoStation M2"');
      expect(decision!.message).toContain('→');
    });

    it('should emit CLEAR WARNING when deviceModel matches previous and active alert exists', () => {
      const prev = makeMetrics({ deviceModel: 'Rocket M5' });
      const metrics = makeMetrics({ deviceModel: 'Rocket M5' });
      const alerts = activeMap(['device_model_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const decision = result.find(
        (d) => d.metric === 'device_model_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when device_model_changed alert is already active', () => {
      const prev = makeMetrics({ deviceModel: 'Rocket M5' });
      const metrics = makeMetrics({ deviceModel: 'NanoStation M2' });
      const alerts = activeMap(['device_model_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const opens = result.filter(
        (d) =>
          d.metric === 'device_model_changed' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('remote_ap_mac_changed', () => {
    it('should return [] when current remoteApMac is null', () => {
      const prev = makeMetrics({ remoteApMac: 'aa:bb:cc:dd:ee:ff' });
      const metrics = makeMetrics({ remoteApMac: null });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'remote_ap_mac_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous remoteApMac is null', () => {
      const prev = makeMetrics({ remoteApMac: null });
      const metrics = makeMetrics({
        remoteApMac: 'aa:bb:cc:dd:ee:ff'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decisions = result.filter(
        (d) => d.metric === 'remote_ap_mac_changed'
      );
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when remoteApMac changes and no active alert', () => {
      const prev = makeMetrics({ remoteApMac: 'aa:bb:cc:dd:ee:ff' });
      const metrics = makeMetrics({
        remoteApMac: 'aa:bb:cc:dd:ee:11'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) => d.metric === 'remote_ap_mac_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
    });

    it('should include the old and new MAC values in the OPEN message', () => {
      const prev = makeMetrics({ remoteApMac: 'aa:bb:cc:dd:ee:ff' });
      const metrics = makeMetrics({
        remoteApMac: 'aa:bb:cc:dd:ee:11'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      const decision = result.find(
        (d) =>
          d.metric === 'remote_ap_mac_changed' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
      expect(decision!.message).toContain('→');
    });

    it('should emit CLEAR WARNING when remoteApMac matches previous and active alert exists', () => {
      const prev = makeMetrics({ remoteApMac: 'aa:bb:cc:dd:ee:ff' });
      const metrics = makeMetrics({
        remoteApMac: 'aa:bb:cc:dd:ee:ff'
      });
      const alerts = activeMap(['remote_ap_mac_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const decision = result.find(
        (d) => d.metric === 'remote_ap_mac_changed'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when remote_ap_mac_changed alert is already active', () => {
      const prev = makeMetrics({ remoteApMac: 'aa:bb:cc:dd:ee:ff' });
      const metrics = makeMetrics({
        remoteApMac: 'aa:bb:cc:dd:ee:11'
      });
      const alerts = activeMap(['remote_ap_mac_changed', 'WARNING']);
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        alerts
      );
      const opens = result.filter(
        (d) =>
          d.metric === 'remote_ap_mac_changed' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('multi-field independence', () => {
    it('should fire OPEN for each field that changes independently', () => {
      const prev = makeMetrics({
        ssid: 'Net-A',
        macAddress: '00:11:22:33:44:55',
        deviceModel: 'Rocket M5',
        remoteApMac: 'aa:bb:cc:dd:ee:ff'
      });
      const metrics = makeMetrics({
        ssid: 'Net-B',
        macAddress: '00:11:22:33:44:66',
        deviceModel: 'NanoStation M2',
        remoteApMac: 'aa:bb:cc:dd:ee:11'
      });
      const result = rule.evaluate(
        metrics,
        makeContext({ previousMetrics: prev }),
        new Map()
      );
      expect(
        result.filter(
          (d) => d.action === 'OPEN' && d.metric === 'ssid_changed'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) =>
            d.action === 'OPEN' && d.metric === 'mac_address_changed'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) =>
            d.action === 'OPEN' && d.metric === 'device_model_changed'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) =>
            d.action === 'OPEN' &&
            d.metric === 'remote_ap_mac_changed'
        )
      ).toHaveLength(1);
    });
  });
});
