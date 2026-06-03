// Source: src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts

import { UbiquitiHttpCollector } from '../../../../src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector';
import { AirOsHttpClient } from '../../../../src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient';
import { HttpCredentials } from '../../../../src/application/wireless-monitoring/interfaces/IUbiquitiHttpCollector';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const credentials: HttpCredentials = {
  username: 'ubnt',
  password: 'ubnt',
  port: 443
};

const staStatusBody = {
  host: {
    hostname: 'cpe-01',
    fwversion: 'WA.v8.7.5',
    uptime: 86400,
    cpuload: 25,
    totalram: 131072,
    freeram: 65536
  },
  wireless: {
    essid: 'ISP-5G',
    mode: 'sta-ptmp',
    frequency: 5180,
    chanbw: 40,
    noisef: -95,
    txpower: 20,
    distance: 1500,
    throughput: { tx: 5000, rx: 3000 },
    sta: [
      {
        mac: 'AA:BB:CC:DD:EE:FF',
        signal: -65,
        noisefloor: -95,
        distance: 1500,
        uptime: 3600,
        tx_latency: 4,
        dl_linkscore: 90,
        ul_linkscore: 85,
        airmax: {
          downlink_capacity: 50000,
          uplink_capacity: 20000,
          rx: { cinr: 22 },
          tx: { cinr: 18 }
        },
        stats: { tx_bytes: 1000000, rx_bytes: 500000, tx_pps: 100, rx_pps: 50 },
        remote: {
          hostname: 'tower-ap',
          platform: 'Rocket 5AC Lite',
          version: 'WA.v8.7.5',
          cpuload: 40,
          totalram: 262144,
          freeram: 131072,
          signal: -68,
          noisefloor: -96,
          tx_power: 23,
          tx_throughput: 3000,
          rx_throughput: 5000,
          ipaddr: ['10.0.0.1']
        },
        lastip: '10.0.1.50'
      }
    ]
  },
  interfaces: [
    {
      ifname: 'eth0',
      status: { speed: 100, plugged: true, tx_bytes: 2000000, rx_bytes: 1000000 }
    },
    {
      ifname: 'ath0',
      status: { tx_bytes: 3000000, rx_bytes: 1500000 }
    }
  ]
};

const apStatusBody = {
  host: {
    hostname: 'ap-tower',
    fwversion: 'WA.v8.7.5',
    uptime: 172800,
    cpuload: 50,
    totalram: 262144,
    freeram: 65536
  },
  wireless: {
    essid: 'ISP-5G',
    mode: 'ap-ptmp',
    frequency: 5180,
    chanbw: 20,
    noisef: -93,
    txpower: 25,
    distance: 0,
    count: 3,
    throughput: { tx: 15000, rx: 8000 },
    sta: [
      {
        mac: 'AA:BB:CC:DD:EE:01',
        signal: -70,
        noisefloor: -95,
        distance: 1000,
        uptime: 7200,
        tx_latency: 5,
        dl_linkscore: 85,
        ul_linkscore: 80,
        airmax: { downlink_capacity: 30000, uplink_capacity: 10000, rx: { cinr: 18 }, tx: { cinr: 15 } },
        stats: { tx_bytes: 500000, rx_bytes: 250000, tx_pps: 80, rx_pps: 40 },
        remote: {
          hostname: 'cpe-a',
          platform: 'LiteBeam 5AC',
          version: 'WA.v8.7.4',
          cpuload: 20,
          totalram: 131072,
          freeram: 98304,
          signal: -72,
          noisefloor: -96,
          tx_power: 20,
          tx_throughput: 8000,
          rx_throughput: 15000,
          ipaddr: ['10.0.1.10']
        },
        lastip: '10.0.1.10'
      }
    ]
  },
  interfaces: [
    {
      ifname: 'eth0',
      status: { speed: 1000, plugged: true, tx_bytes: 5000000, rx_bytes: 2000000 }
    }
  ]
};

// ---------------------------------------------------------------------------
// Mock AirOsHttpClient
// ---------------------------------------------------------------------------

function makeClient(body: unknown): jest.Mocked<AirOsHttpClient> {
  return {
    fetchStatus: jest.fn().mockResolvedValue(Result.ok(body))
  } as unknown as jest.Mocked<AirOsHttpClient>;
}

function makeFailingClient(error: string): jest.Mocked<AirOsHttpClient> {
  return {
    fetchStatus: jest.fn().mockResolvedValue(Result.fail(error))
  } as unknown as jest.Mocked<AirOsHttpClient>;
}

// ---------------------------------------------------------------------------

describe('UbiquitiHttpCollector', () => {

  // ===========================================================================
  describe('collect — STATION mode', () => {
    it('should return success with parsed device fields', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.isSuccess).toBe(true);
      const d = result.value;
      expect(d.deviceName).toBe('cpe-01');
      expect(d.firmwareVersion).toBe('WA.v8.7.5');
      expect(d.uptimeSeconds).toBe(86400);
      expect(d.cpuLoadPercent).toBe(25);
      expect(d.memoryUsedPercent).toBeCloseTo(50);
    });

    it('should parse wireless radio fields', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      const d = result.value;
      expect(d.essid).toBe('ISP-5G');
      expect(d.mode).toBe('sta-ptmp');
      expect(d.frequencyMhz).toBe(5180);
      expect(d.channelWidthMhz).toBe(40);
      expect(d.noiseFloorDbm).toBe(-95);
      expect(d.txPowerDbm).toBe(20);
    });

    it('should convert throughput from kbps to bps', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.throughputTxBps).toBe(5_000_000);
      expect(result.value.throughputRxBps).toBe(3_000_000);
    });

    it('should extract signalRxDbm from sta[0].signal in STA mode', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.signalRxDbm).toBe(-65);
    });

    it('should extract latencyMs from sta[0].tx_latency in STA mode', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.latencyMs).toBe(4);
    });

    it('should extract remoteApMac and remoteApName from sta[0] in STA mode', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.remoteApMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value.remoteApName).toBe('tower-ap');
    });

    it('should return empty clients array in STA mode', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.clients).toEqual([]);
    });

    it('should set clientsConnected to null in STA mode', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.clientsConnected).toBeNull();
    });

    it('should parse LAN status from eth0.status.plugged', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.lanStatus).toBe('UP');
      expect(result.value.lanSpeedMbps).toBe(100);
    });

    it('should report lanStatus as DOWN when plugged is false', async () => {
      const body = JSON.parse(JSON.stringify(staStatusBody));
      body.interfaces[0].status.plugged = false;
      const collector = new UbiquitiHttpCollector(makeClient(body));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.lanStatus).toBe('DOWN');
    });
  });

  // ===========================================================================
  describe('collect — ACCESS_POINT mode', () => {
    it('should return clientsConnected from wireless.count', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(apStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'ACCESS_POINT');

      expect(result.value.clientsConnected).toBe(3);
    });

    it('should populate clients array from wireless.sta', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(apStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'ACCESS_POINT');

      expect(result.value.clients).toHaveLength(1);
      const c = result.value.clients[0]!;
      expect(c.macAddress).toBe('AA:BB:CC:DD:EE:01');
      expect(c.signalRxDbm).toBe(-70);
      expect(c.distanceM).toBe(1000);
      expect(c.uptimeSeconds).toBe(7200);
    });

    it('should parse all client detail fields', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(apStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'ACCESS_POINT');

      const c = result.value.clients[0]!;
      expect(c.txLatencyMs).toBe(5);
      expect(c.dlLinkScore).toBe(85);
      expect(c.ulLinkScore).toBe(80);
      expect(c.dlCapacityKbps).toBe(30000);
      expect(c.ulCapacityKbps).toBe(10000);
      expect(c.dlCinr).toBe(18);
      expect(c.ulCinr).toBe(15);
      expect(c.txBytesTotal).toBe(BigInt(500000));
      expect(c.rxBytesTotal).toBe(BigInt(250000));
      expect(c.txPps).toBe(80);
      expect(c.rxPps).toBe(40);
    });

    it('should parse remote device fields on each client', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(apStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'ACCESS_POINT');

      const c = result.value.clients[0]!;
      expect(c.remoteHostname).toBe('cpe-a');
      expect(c.remotePlatform).toBe('LiteBeam 5AC');
      expect(c.remoteVersion).toBe('WA.v8.7.4');
      expect(c.remoteCpuLoad).toBe(20);
      expect(c.remoteSignal).toBe(-72);
      expect(c.remoteTxThroughputKbps).toBe(8000);
      expect(c.remoteIpAddresses).toEqual(['10.0.1.10']);
    });

    it('should set signalRxDbm to null in AP mode (no aggregate signal)', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(apStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'ACCESS_POINT');

      expect(result.value.signalRxDbm).toBeNull();
    });
  });

  // ===========================================================================
  describe('collect — field edge cases', () => {
    it('should return null channelWidthMhz when chanbw is 0', async () => {
      const body = JSON.parse(JSON.stringify(staStatusBody));
      body.wireless.chanbw = 0;
      const collector = new UbiquitiHttpCollector(makeClient(body));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.channelWidthMhz).toBeNull();
    });

    it('should return null memoryUsedPercent when totalram is 0', async () => {
      const body = JSON.parse(JSON.stringify(staStatusBody));
      body.host.totalram = 0;
      const collector = new UbiquitiHttpCollector(makeClient(body));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.memoryUsedPercent).toBeNull();
    });

    it('should return null ccqPercent when ccq field is absent', async () => {
      const collector = new UbiquitiHttpCollector(makeClient(staStatusBody));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.ccqPercent).toBeNull();
    });

    it('should return null mode when wireless.mode is unrecognised', async () => {
      const body = JSON.parse(JSON.stringify(staStatusBody));
      body.wireless.mode = 'unknown-mode';
      const collector = new UbiquitiHttpCollector(makeClient(body));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.mode).toBeNull();
    });

    it('should return null lanStatus when eth0 interface is missing', async () => {
      const body = JSON.parse(JSON.stringify(staStatusBody));
      body.interfaces = [];
      const collector = new UbiquitiHttpCollector(makeClient(body));

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.value.lanStatus).toBeNull();
    });
  });

  // ===========================================================================
  describe('collect — AirOsHttpClient failure', () => {
    it('should return a failed Result when AirOsHttpClient fails', async () => {
      const collector = new UbiquitiHttpCollector(
        makeFailingClient('HTTPS_TIMEOUT')
      );

      const result = await collector.collect('192.168.1.1', credentials, 'STATION');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('HTTPS_TIMEOUT');
    });
  });
});
