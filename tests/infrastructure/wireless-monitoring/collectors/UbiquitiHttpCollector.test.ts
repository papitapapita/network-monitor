// Source: src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts

import { UbiquitiHttpCollector } from '../../../../src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector';
import { HttpCredentials } from 'application/wireless-monitoring/interfaces';

// NOTE: UbiquitiHttpCollector uses the global `fetch` API internally.
// We replace it with a jest.fn() on the global object so no real HTTP calls are made.

const credentials: HttpCredentials = {
  username: 'ubnt',
  password: 'ubnt',
  port: 80,
  useHttps: false,
};

const makeOkResponse = (body: unknown): Response => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
} as unknown as Response);

const makeErrorResponse = (status: number): Response => ({
  ok: false,
  status,
  json: () => Promise.resolve({}),
} as unknown as Response);

const fullStatusBody = {
  wireless: {
    signal: -65,
    rssi: -65,
    noisef: -95,
    txrate: 54000,
    rxrate: 48000,
    ccq: 980,
    frequency: 5180,
    txpower: 23,
    distance: 1500,
    apmac: 'AA:BB:CC:DD:EE:FF',
    apname: 'tower-ap-1',
  },
  interfaces: [
    { ifname: 'eth0', status: 'UP', speed: 100 },
  ],
  host: {
    uptime: 3600,
    fwversion: 'XW.v8.7.1',
    hostname: 'ubnt-cpe-1',
  },
};

describe('UbiquitiHttpCollector', () => {
  let collector: UbiquitiHttpCollector;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    collector = new UbiquitiHttpCollector();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Restore the original fetch (typically undefined in Node test env)
    delete (global as Record<string, unknown>).fetch;
  });

  describe('collect — happy path', () => {
    it('should return a successful Result with all parsed fields from a full status response', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.isSuccess).toBe(true);
      const data = result.value;
      expect(data.signalRxDbm).toBe(-65);
      expect(data.noiseFloorDbm).toBe(-95);
      expect(data.txRateMbps).toBe(54);   // 54000 / 1000
      expect(data.rxRateMbps).toBe(48);   // 48000 / 1000
      expect(data.ccqPercent).toBe(98);   // 980 / 10
      expect(data.frequencyMhz).toBe(5180);
      expect(data.txPowerDbm).toBe(23);
      expect(data.distanceM).toBe(1500);
      expect(data.uptimeSeconds).toBe(3600);
      expect(data.firmwareVersion).toBe('XW.v8.7.1');
      expect(data.deviceName).toBe('ubnt-cpe-1');
      expect(data.remoteApMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(data.remoteApName).toBe('tower-ap-1');
      expect(data.lanStatus).toBe('UP');
      expect(data.lanSpeedMbps).toBe(100);
    });

    it('should use HTTPS scheme when credentials.useHttps is true', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));
      const httpsCredentials: HttpCredentials = { ...credentials, useHttps: true, port: 443 };

      await collector.collect('192.168.1.1', httpsCredentials);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/^https:/);
    });

    it('should use HTTP scheme when credentials.useHttps is false', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));

      await collector.collect('192.168.1.1', credentials);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/^http:/);
    });

    it('should call /status.cgi endpoint for collect', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));

      await collector.collect('192.168.1.1', credentials);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/status.cgi');
    });

    it('should include a Basic Authorization header with base64-encoded credentials', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));

      await collector.collect('192.168.1.1', credentials);

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = options.headers as Record<string, string>;
      const expectedToken = Buffer.from('ubnt:ubnt').toString('base64');
      expect(headers['Authorization']).toBe(`Basic ${expectedToken}`);
    });

    it('should report lanStatus as DOWN when the LAN interface status field is "down" (case-insensitive)', async () => {
      const body = {
        ...fullStatusBody,
        interfaces: [{ ifname: 'eth0', status: 'down', speed: 100 }],
      };
      mockFetch.mockResolvedValue(makeOkResponse(body));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.lanStatus).toBe('DOWN');
    });

    it('should report lanStatus as null when the LAN interface status is an unrecognised string', async () => {
      const body = {
        ...fullStatusBody,
        interfaces: [{ ifname: 'eth0', status: 'UNKNOWN', speed: 100 }],
      };
      mockFetch.mockResolvedValue(makeOkResponse(body));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.lanStatus).toBeNull();
    });

    it('should fall back to rssi when signal is absent from the wireless object', async () => {
      const body = {
        ...fullStatusBody,
        wireless: { ...fullStatusBody.wireless, signal: undefined, rssi: -70 },
      };
      mockFetch.mockResolvedValue(makeOkResponse(body));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.signalRxDbm).toBe(-70);
    });

    it('should return null txRateMbps when txrate is absent from the wireless object', async () => {
      const body = {
        ...fullStatusBody,
        wireless: { ...fullStatusBody.wireless, txrate: undefined },
      };
      mockFetch.mockResolvedValue(makeOkResponse(body));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.txRateMbps).toBeNull();
    });

    it('should return null ccqPercent when ccq is absent', async () => {
      const body = {
        ...fullStatusBody,
        wireless: { ...fullStatusBody.wireless, ccq: undefined },
      };
      mockFetch.mockResolvedValue(makeOkResponse(body));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.ccqPercent).toBeNull();
    });

    it('should always return latencyMs as null (not collected via HTTP)', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(fullStatusBody));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.value.latencyMs).toBeNull();
    });
  });

  describe('collect — non-200 response', () => {
    it('should return a failed Result when the response status is 401', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('401');
    });

    it('should return a failed Result when the response status is 500', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('500');
    });
  });

  describe('collect — network failure', () => {
    it('should return a failed Result when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('HTTP collection failed');
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should return a failed Result when the AbortController aborts the request (timeout)', async () => {
      mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

      const result = await collector.collect('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('collectClients — happy path', () => {
    it('should call /sta.cgi endpoint', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));

      await collector.collectClients('192.168.1.1', credentials);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/sta.cgi');
    });

    it('should return an empty array when the response is an empty JSON array', async () => {
      mockFetch.mockResolvedValue(makeOkResponse([]));

      const result = await collector.collectClients('192.168.1.1', credentials);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should parse all client entry fields correctly', async () => {
      const clientsData = [
        {
          mac: 'AA:BB:CC:DD:EE:01',
          signal: -70,
          remote_signal: -72,
          txrate: 54000,
          rxrate: 48000,
          ccq: 960,
          uptime: 1200,
          ip: '192.168.200.10',
        },
      ];
      mockFetch.mockResolvedValue(makeOkResponse(clientsData));

      const result = await collector.collectClients('192.168.1.1', credentials);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      const client = result.value[0]!;
      expect(client.macAddress).toBe('AA:BB:CC:DD:EE:01');
      expect(client.signalRxDbm).toBe(-70);
      expect(client.signalTxDbm).toBe(-72);
      expect(client.txRateMbps).toBe(54);
      expect(client.rxRateMbps).toBe(48);
      expect(client.ccqPercent).toBe(96); // 960 / 10
      expect(client.uptimeSeconds).toBe(1200);
      expect(client.ipAddress).toBe('192.168.200.10');
    });

    it('should return an empty array when the response body is not an array', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ unexpected: 'object' }));

      const result = await collector.collectClients('192.168.1.1', credentials);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });
  });

  describe('collectClients — failure paths', () => {
    it('should return a failed Result when the response status is not 200', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403));

      const result = await collector.collectClients('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('403');
    });

    it('should return a failed Result when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await collector.collectClients('192.168.1.1', credentials);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('HTTP clients collection failed');
    });
  });
});
