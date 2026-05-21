// Source: src/infrastructure/wireless-monitoring/collectors/SNMPCollector.ts

jest.mock('net-snmp', () => {
  const mockSession = {
    get: jest.fn(),
    close: jest.fn(),
  };
  return {
    createSession: jest.fn(() => mockSession),
    createV3Session: jest.fn(() => mockSession),
    isVarbindError: jest.fn(() => false),
    SecurityLevel: { authPriv: 3 },
    AuthProtocols: { sha: 'sha', md5: 'md5' },
    PrivProtocols: { aes: 'aes', des: 'des' },
    Version2c: 1,
    __mockSession: mockSession,
  };
});

import * as snmp from 'net-snmp';
import { SNMPCollector } from '../../../../src/infrastructure/wireless-monitoring/collectors/SNMPCollector';
import { SNMPCredentials } from 'application/wireless-monitoring/interfaces';

// Access the shared mock session through the module-level export
const snmpMock = snmp as typeof snmp & { __mockSession: { get: jest.Mock; close: jest.Mock } };
const mockSession = snmpMock.__mockSession;

const credentialsV2: SNMPCredentials = {
  version: 2,
  community: 'public',
  port: 161,
};

const credentialsV3: SNMPCredentials = {
  version: 3,
  authUser: 'admin',
  authProtocol: 'SHA',
  authKey: 'authkey123',
  privProtocol: 'AES',
  privKey: 'privkey123',
  port: 161,
};

type SnmpVarbind = snmp.Varbind;

const makeVarbind = (oid: string, value: unknown): SnmpVarbind =>
  ({ oid, value }) as unknown as SnmpVarbind;

/**
 * Builds a full set of varbinds simulating a healthy Ubiquiti device response.
 */
const makeFullVarbinds = (): SnmpVarbind[] => [
  makeVarbind('1.3.6.1.2.1.1.1.0', Buffer.from('AirOS v8.7.1 XW')),
  makeVarbind('1.3.6.1.2.1.1.5.0', Buffer.from('ubnt-cpe-1')),
  makeVarbind('1.3.6.1.2.1.1.3.0', 360000),
  makeVarbind('1.3.6.1.2.1.2.2.1.8.2', 1),
  makeVarbind('1.3.6.1.2.1.2.2.1.5.2', 100_000_000),
  makeVarbind('1.3.6.1.2.1.31.1.1.1.6.2', '1000000'),
  makeVarbind('1.3.6.1.2.1.31.1.1.1.10.2', '2000000'),
  makeVarbind('1.3.6.1.2.1.31.1.1.1.7.2', 100),
  makeVarbind('1.3.6.1.2.1.31.1.1.1.11.2', 200),
  makeVarbind('1.3.6.1.4.1.41112.1.4.1.1.4.1', 5180),
  makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.5.1', -65),       // signalRxDbm
  makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.8.1', -95),       // noiseFloorDbm
  makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.7.1', 980),       // CCQ raw → 98%
  makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.9.1', 54_000_000),  // TxRate bps → 54 Mbps
  makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.10.1', 48_000_000), // RxRate bps → 48 Mbps
  makeVarbind('1.3.6.1.4.1.41112.1.4.8.3.0', 3),
];

const resolveWith = (varbinds: SnmpVarbind[]) => {
  mockSession.get.mockImplementationOnce(
    (_oids: string[], cb: (err: Error | null, varbinds: SnmpVarbind[]) => void) => {
      cb(null, varbinds);
    }
  );
};

const rejectWith = (error: Error) => {
  mockSession.get.mockImplementationOnce(
    (_oids: string[], cb: (err: Error | null, varbinds: SnmpVarbind[]) => void) => {
      cb(error, []);
    }
  );
};

describe('SNMPCollector', () => {
  let collector: SNMPCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    collector = new SNMPCollector();
  });

  describe('collect — happy path (SNMPv2)', () => {
    it('should return a successful Result with parsed metrics when the SNMP session succeeds', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isSuccess).toBe(true);
      const data = result.value;
      expect(data.signalRxDbm).toBe(-65);
      expect(data.noiseFloorDbm).toBe(-95);
      expect(data.ccqPercent).toBe(98);
      expect(data.txRateMbps).toBe(54);  // 54_000_000 / 1_000_000
      expect(data.rxRateMbps).toBe(48);  // 48_000_000 / 1_000_000
      expect(data.frequencyMhz).toBe(5180);
      expect(data.txPowerDbm).toBeNull();
      expect(data.clientsConnected).toBe(3);
    });

    it('should parse ifHCInOctets and ifHCOutOctets as BigInt values', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.ifHCInOctets).toBe(1_000_000n);
      expect(result.value.ifHCOutOctets).toBe(2_000_000n);
    });

    it('should report lanStatus as UP when ifOperStatus is 1', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.lanStatus).toBe('UP');
    });

    it('should report lanStatus as DOWN when ifOperStatus is 2', async () => {
      const varbinds = makeFullVarbinds().map(v =>
        v.oid === '1.3.6.1.2.1.2.2.1.8.2' ? makeVarbind(v.oid, 2) : v
      );
      resolveWith(varbinds);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.lanStatus).toBe('DOWN');
    });

    it('should report lanStatus as null when ifOperStatus is neither 1 nor 2', async () => {
      const varbinds = makeFullVarbinds().map(v =>
        v.oid === '1.3.6.1.2.1.2.2.1.8.2' ? makeVarbind(v.oid, 3) : v
      );
      resolveWith(varbinds);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.lanStatus).toBeNull();
    });

    it('should convert lanSpeedMbps by dividing raw ifSpeed by 1,000,000', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.lanSpeedMbps).toBe(100); // 100_000_000 / 1_000_000
    });

    it('should extract firmwareVersion from sysDescr using the version pattern', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.firmwareVersion).toBe('8.7.1');
    });

    it('should convert uptimeSeconds from sysUpTime (hundredths of a second)', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.uptimeSeconds).toBe(3600); // 360000 / 100
    });

    it('should return null for signalTxDbm, txPowerDbm, channelWidthMhz, lanDuplex, cpuLoadPercent, memoryUsedPercent, remoteApMac, remoteApName, distanceM, latencyMs', async () => {
      resolveWith(makeFullVarbinds());

      const result = await collector.collect('192.168.1.1', credentialsV2);
      const d = result.value;

      expect(d.signalTxDbm).toBeNull();
      expect(d.txPowerDbm).toBeNull();
      expect(d.channelWidthMhz).toBeNull();
      expect(d.lanDuplex).toBeNull();
      expect(d.cpuLoadPercent).toBeNull();
      expect(d.memoryUsedPercent).toBeNull();
      expect(d.remoteApMac).toBeNull();
      expect(d.remoteApName).toBeNull();
      expect(d.distanceM).toBeNull();
      expect(d.latencyMs).toBeNull();
    });
  });

  describe('collect — SNMPv3 session creation', () => {
    it('should call snmp.createV3Session instead of createSession when credentials.version is 3', async () => {
      resolveWith(makeFullVarbinds());

      await collector.collect('192.168.1.1', credentialsV3);

      expect(snmp.createV3Session).toHaveBeenCalledTimes(1);
      expect(snmp.createSession).not.toHaveBeenCalled();
    });

    it('should call snmp.createSession when credentials.version is 2', async () => {
      resolveWith(makeFullVarbinds());

      await collector.collect('192.168.1.1', credentialsV2);

      expect(snmp.createSession).toHaveBeenCalledTimes(1);
      expect(snmp.createV3Session).not.toHaveBeenCalled();
    });
  });

  describe('collect — session lifecycle', () => {
    it('should always close the session after a successful collection', async () => {
      resolveWith(makeFullVarbinds());

      await collector.collect('192.168.1.1', credentialsV2);

      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });

    it('should close the session even when the SNMP get callback returns an error', async () => {
      rejectWith(new Error('network unreachable'));

      await collector.collect('192.168.1.1', credentialsV2);

      expect(mockSession.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('collect — failure paths', () => {
    it('should return a failed Result when the SNMP session returns an error', async () => {
      rejectWith(new Error('network unreachable'));

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('SNMP error');
    });

    it('should return a failed Result with SNMP_TIMEOUT when the error message contains "Timed out"', async () => {
      rejectWith(new Error('Timed out waiting for response'));

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('SNMP_TIMEOUT');
    });

    it('should return a failed Result with SNMP_TIMEOUT when the error message contains "timeout"', async () => {
      rejectWith(new Error('connection timeout'));

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('SNMP_TIMEOUT');
    });
  });

  describe('collect — OID mapping and null handling', () => {
    it('should return null for numeric fields when the corresponding OID is absent from the response', async () => {
      // Provide only the interface-status OID; everything else is missing
      resolveWith([makeVarbind('1.3.6.1.2.1.2.2.1.8.2', 1)]);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isSuccess).toBe(true);
      expect(result.value.signalRxDbm).toBeNull();
      expect(result.value.txRateMbps).toBeNull();
      expect(result.value.rxRateMbps).toBeNull();
      expect(result.value.clientsConnected).toBeNull();
    });

    it('should return null for BigInt fields when the OID is absent', async () => {
      resolveWith([]);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.isSuccess).toBe(true);
      expect(result.value.ifHCInOctets).toBeNull();
      expect(result.value.ifHCOutOctets).toBeNull();
    });

    it('should treat varbinds flagged as errors by isVarbindError as absent (return null)', async () => {
      (snmp.isVarbindError as jest.Mock).mockReturnValueOnce(true);
      const varbinds = [makeVarbind('1.3.6.1.4.1.41112.1.4.5.1.5.1', -65)];
      resolveWith(varbinds);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.signalRxDbm).toBeNull();
    });

    it('should return null txRateMbps when the raw tx-rate OID value is null', async () => {
      const varbinds = makeFullVarbinds().map(v =>
        v.oid === '1.3.6.1.4.1.41112.1.4.5.1.9.1' ? makeVarbind(v.oid, null) : v
      );
      resolveWith(varbinds);

      const result = await collector.collect('192.168.1.1', credentialsV2);

      expect(result.value.txRateMbps).toBeNull();
    });
  });
});
