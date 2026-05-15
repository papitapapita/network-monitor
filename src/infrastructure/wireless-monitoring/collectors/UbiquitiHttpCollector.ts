import { Result } from 'domain/shared/core';
import {
  IUbiquitiHttpCollector,
  HttpCredentials,
  HttpCollectionResult,
  HttpClientEntry
} from 'application/wireless-monitoring/interfaces';

export class UbiquitiHttpCollector implements IUbiquitiHttpCollector {
  private readonly timeoutMs = 5000;

  async collect(
    ipAddress: string,
    credentials: HttpCredentials
  ): Promise<Result<HttpCollectionResult>> {
    try {
      const scheme = credentials.useHttps ? 'https' : 'http';
      const url = `${scheme}://${ipAddress}:${credentials.port}/status.cgi`;
      const response = await this.fetchWithTimeout(url, credentials);

      if (!response.ok) {
        return Result.fail(`HTTP ${response.status} from ${url}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      return Result.ok(this.parseStatusCgi(data));
    } catch (error) {
      return Result.fail(
        `HTTP collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async collectClients(
    ipAddress: string,
    credentials: HttpCredentials
  ): Promise<Result<HttpClientEntry[]>> {
    try {
      const scheme = credentials.useHttps ? 'https' : 'http';
      const url = `${scheme}://${ipAddress}:${credentials.port}/sta.cgi`;
      const response = await this.fetchWithTimeout(url, credentials);

      if (!response.ok) {
        return Result.fail(`HTTP ${response.status} from ${url}`);
      }

      const data = (await response.json()) as unknown[];
      if (!Array.isArray(data)) return Result.ok([]);

      return Result.ok(
        data.map((item) =>
          this.parseClientEntry(item as Record<string, unknown>)
        )
      );
    } catch (error) {
      return Result.fail(
        `HTTP clients collection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private fetchWithTimeout(
    url: string,
    credentials: HttpCredentials
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );
    const authHeader =
      'Basic ' +
      Buffer.from(
        `${credentials.username}:${credentials.password}`
      ).toString('base64');
    return fetch(url, {
      signal: controller.signal,
      headers: { Authorization: authHeader }
    }).finally(() => clearTimeout(timer));
  }

  private parseStatusCgi(
    data: Record<string, unknown>
  ): HttpCollectionResult {
    const wireless = (data['wireless'] ?? {}) as Record<
      string,
      unknown
    >;
    const interfaces = Array.isArray(data['interfaces'])
      ? (data['interfaces'] as Record<string, unknown>[])
      : [];
    const lanIface =
      interfaces.find((i) => i['ifname'] === 'eth0') ?? {};
    const host = (data['host'] ?? {}) as Record<string, unknown>;

    const numFrom = (
      obj: Record<string, unknown>,
      key: string
    ): number | null => {
      const v = obj[key];
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const strFrom = (
      obj: Record<string, unknown>,
      key: string
    ): string | null => {
      const v = obj[key];
      if (v === null || v === undefined) return null;
      return String(v);
    };

    const txRateRaw = numFrom(wireless, 'txrate');
    const rxRateRaw = numFrom(wireless, 'rxrate');
    const ccqRaw = numFrom(wireless, 'ccq');
    const lanStatusRaw = strFrom(
      lanIface as Record<string, unknown>,
      'status'
    );

    return {
      signalRxDbm:
        numFrom(wireless, 'signal') ?? numFrom(wireless, 'rssi'),
      noiseFloorDbm: numFrom(wireless, 'noisef'),
      txRateMbps: txRateRaw !== null ? txRateRaw / 1000 : null,
      rxRateMbps: rxRateRaw !== null ? rxRateRaw / 1000 : null,
      ccqPercent: ccqRaw !== null ? ccqRaw / 10 : null,
      frequencyMhz: numFrom(wireless, 'frequency'),
      txPowerDbm: numFrom(wireless, 'txpower'),
      distanceM: numFrom(wireless, 'distance'),
      latencyMs: null,
      uptimeSeconds: numFrom(host, 'uptime'),
      firmwareVersion: strFrom(host, 'fwversion'),
      deviceName: strFrom(host, 'hostname'),
      remoteApMac: strFrom(wireless, 'apmac'),
      remoteApName: strFrom(wireless, 'apname'),
      lanStatus:
        lanStatusRaw === 'UP' || lanStatusRaw === 'up'
          ? 'UP'
          : lanStatusRaw === 'DOWN' || lanStatusRaw === 'down'
            ? 'DOWN'
            : null,
      lanSpeedMbps: numFrom(
        lanIface as Record<string, unknown>,
        'speed'
      ),
      clients: []
    };
  }

  private parseClientEntry(
    item: Record<string, unknown>
  ): HttpClientEntry {
    const num = (key: string): number | null => {
      const v = item[key];
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const txRateRaw = num('txrate');
    const rxRateRaw = num('rxrate');
    const ccqRaw = num('ccq');

    return {
      macAddress: String(item['mac'] ?? item['macaddr'] ?? ''),
      signalRxDbm: num('signal') ?? num('rssi'),
      signalTxDbm: num('remote_signal'),
      snrDb: null,
      txRateMbps: txRateRaw !== null ? txRateRaw / 1000 : null,
      rxRateMbps: rxRateRaw !== null ? rxRateRaw / 1000 : null,
      ccqPercent: ccqRaw !== null ? ccqRaw / 10 : null,
      uptimeSeconds: num('uptime'),
      ipAddress: item['ip'] ? String(item['ip']) : null
    };
  }
}
