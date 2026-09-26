// Source: src/infrastructure/wireless-monitoring/collectors/MimosaSnmpCollector.ts

import { VarbindValue } from 'net-snmp';
import {
  MimosaSnmpCollector,
  MIMOSA_OIDS
} from '../../../../src/infrastructure/wireless-monitoring/collectors/MimosaSnmpCollector';
import { SnmpClient } from '../../../../src/infrastructure/wireless-monitoring/collectors/SnmpClient';
import { DecryptedCredentials } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceCredentialsRepository';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixtures — values as a real C5c on firmware 2.14.0 returned them
// ---------------------------------------------------------------------------

const credentials: DecryptedCredentials = {
  snmpVersion: 2,
  snmpCommunity: 'nms-ro',
  snmpV3AuthUser: null,
  snmpV3AuthProto: null,
  snmpV3AuthKey: null,
  snmpV3PrivProto: null,
  snmpV3PrivKey: null,
  httpUsername: null,
  httpPassword: null,
  snmpPort: 161,
  httpPort: 443
};

const NOW = new Date('2026-09-26T01:23:40Z');

function c5cValues(): Map<string, VarbindValue> {
  return new Map<string, VarbindValue>([
    [MIMOSA_OIDS.deviceName, Buffer.from('airspan')],
    [MIMOSA_OIDS.firmwareVersion, Buffer.from('2.14.0')],
    [
      MIMOSA_OIDS.lastRebootTime,
      Buffer.from('2026-09-22 11:10:14 (UTC +0000)')
    ],
    [MIMOSA_OIDS.wanSsid, Buffer.from('APJDJFOFICINA')],
    [
      MIMOSA_OIDS.wanMac,
      Buffer.from([0x20, 0xb5, 0xc6, 0x23, 0x96, 0x06])
    ],
    [MIMOSA_OIDS.chainRxPower(1), -544],
    [MIMOSA_OIDS.chainRxPower(2), -532],
    [MIMOSA_OIDS.chainRxNoise(1), -838],
    [MIMOSA_OIDS.chainRxNoise(2), -838],
    [MIMOSA_OIDS.channelWidth, 80],
    [MIMOSA_OIDS.channelCenterFreq, 6020],
    [MIMOSA_OIDS.phyTxRate, 30678713],
    [MIMOSA_OIDS.phyRxRate, 3362490],
    [MIMOSA_OIDS.sysDescr, Buffer.from('AIRSPAN-C5c')],
    [MIMOSA_OIDS.ethOperStatus, 1],
    [MIMOSA_OIDS.ethHighSpeed, 1000]
  ]);
}

function makeClient(
  values: Map<string, VarbindValue>
): jest.Mocked<SnmpClient> {
  return {
    get: jest.fn().mockResolvedValue(Result.ok(values))
  } as unknown as jest.Mocked<SnmpClient>;
}

async function collect(values: Map<string, VarbindValue>) {
  const collector = new MimosaSnmpCollector(
    makeClient(values),
    () => NOW
  );
  return collector.collect('172.16.50.8', credentials);
}

// ---------------------------------------------------------------------------

describe('[WLS-054] MimosaSnmpCollector', () => {
  it('should report snmp as its collection method', () => {
    expect(
      new MimosaSnmpCollector(makeClient(new Map())).method
    ).toBe('snmp');
  });

  it('should query the radio with the given IP and credentials', async () => {
    const client = makeClient(c5cValues());

    await new MimosaSnmpCollector(client).collect(
      '172.16.50.8',
      credentials
    );

    expect(client.get).toHaveBeenCalledWith(
      '172.16.50.8',
      credentials,
      expect.arrayContaining([
        MIMOSA_OIDS.firmwareVersion,
        MIMOSA_OIDS.phyTxRate
      ])
    );
  });

  describe('parsing a C5c', () => {
    it('should read identity fields', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.deviceName).toBe('airspan');
      expect(d.firmwareVersion).toBe('2.14.0');
      expect(d.deviceModel).toBe('AIRSPAN-C5c');
      expect(d.essid).toBe('APJDJFOFICINA');
      expect(d.macAddress).toBe('20:B5:C6:23:96:06');
    });

    it('should read the channel', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.frequencyMhz).toBe(6020);
      expect(d.channelWidthMhz).toBe(80);
    });

    it('should average signal and noise across RF chains', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.signalRxDbm).toBe(-53.8);
      expect(d.noiseFloorDbm).toBe(-83.8);
    });

    it('should convert PHY traffic rates from hundredths of kbps to bps', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.throughputTxBps).toBe(306_787_130);
      expect(d.throughputRxBps).toBe(33_624_900);
    });

    it('should report throughput as a whole number of bps', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.phyTxRate, 26594334);

      const d = (await collect(values)).value;

      expect(d.throughputTxBps).toBe(265_943_340);
    });

    it('should derive uptime from the last reboot time', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.uptimeSeconds).toBe(
        3 * 86400 + 14 * 3600 + 13 * 60 + 26
      );
    });

    it('should read the Ethernet port state', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.lanStatus).toBe('UP');
      expect(d.lanSpeedMbps).toBe(1000);
    });

    it('should leave fields the MIB does not expose as null', async () => {
      const d = (await collect(c5cValues())).value;

      expect(d.cpuLoadPercent).toBeNull();
      expect(d.memoryUsedPercent).toBeNull();
      expect(d.distanceM).toBeNull();
      expect(d.latencyMs).toBeNull();
      expect(d.ccqPercent).toBeNull();
      expect(d.capacityTxKbps).toBeNull();
      expect(d.capacityRxKbps).toBeNull();
      expect(d.signalTxDbm).toBeNull();
      expect(d.deviceTimeEpoch).toBeNull();
      expect(d.mode).toBeNull();
      expect(d.clients).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should ignore an RF chain marked invalid with -100 dBm', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.chainRxPower(2), -1000);
      values.set(MIMOSA_OIDS.chainRxNoise(2), -950);

      const d = (await collect(values)).value;

      expect(d.signalRxDbm).toBe(-54.4);
      expect(d.noiseFloorDbm).toBe(-83.8);
    });

    it('should report null signal when no chain is valid', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.chainRxPower(1), -1000);
      values.set(MIMOSA_OIDS.chainRxPower(2), -1000);

      const d = (await collect(values)).value;

      expect(d.signalRxDbm).toBeNull();
      expect(d.noiseFloorDbm).toBeNull();
    });

    it('should report the LAN as DOWN when ifOperStatus is 2', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.ethOperStatus, 2);

      expect((await collect(values)).value.lanStatus).toBe('DOWN');
    });

    it('should honour a non-UTC offset in the reboot time', async () => {
      const values = c5cValues();
      values.set(
        MIMOSA_OIDS.lastRebootTime,
        Buffer.from('2026-09-25 20:23:40 (UTC -0500)')
      );

      expect((await collect(values)).value.uptimeSeconds).toBe(0);
    });

    it('should report null uptime for an unparseable reboot time', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.lastRebootTime, Buffer.from('N/A'));

      expect((await collect(values)).value.uptimeSeconds).toBeNull();
    });

    it('should report null uptime for a reboot time in the future', async () => {
      const values = c5cValues();
      values.set(
        MIMOSA_OIDS.lastRebootTime,
        Buffer.from('2027-01-01 00:00:00 (UTC +0000)')
      );

      expect((await collect(values)).value.uptimeSeconds).toBeNull();
    });

    it('should strip the trailing NUL some string values carry', async () => {
      const values = c5cValues();
      values.set(MIMOSA_OIDS.deviceName, Buffer.from('tower-3\0'));

      expect((await collect(values)).value.deviceName).toBe(
        'tower-3'
      );
    });

    it('should turn a missing field into null rather than failing', async () => {
      const values = c5cValues();
      values.delete(MIMOSA_OIDS.channelCenterFreq);
      values.delete(MIMOSA_OIDS.phyTxRate);

      const result = await collect(values);

      expect(result.isSuccess).toBe(true);
      expect(result.value.frequencyMhz).toBeNull();
      expect(result.value.throughputTxBps).toBeNull();
    });
  });

  describe('failures', () => {
    it('should fail when the SNMP request fails', async () => {
      const client = {
        get: jest
          .fn()
          .mockResolvedValue(
            Result.fail('SNMP request failed: timeout')
          )
      } as unknown as jest.Mocked<SnmpClient>;

      const result = await new MimosaSnmpCollector(client).collect(
        '172.16.50.8',
        credentials
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('timeout');
    });

    it('should fail when the device does not answer the Mimosa MIB', async () => {
      const values = new Map<string, VarbindValue>([
        [MIMOSA_OIDS.sysDescr, Buffer.from('Linux router')]
      ]);

      const result = await collect(values);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Mimosa MIB');
    });
  });
});
