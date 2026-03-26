import ping from 'ping';
import { Result } from 'domain/shared/core';
import {
  IPingService,
  PingResponse
} from 'application/device-monitoring/interfaces';

const DEFAULT_TIMEOUT_MS = 5000;

export class PingService implements IPingService {
  async ping(
    ipAddress: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Result<PingResponse>> {
    try {
      const response = await ping.promise.probe(ipAddress, {
        timeout: timeoutMs / 1000,
        min_reply: 1
      });

      return Result.ok<PingResponse>({
        isReachable: response.alive,
        latencyMs:
          response.alive && response.time !== 'unknown'
            ? Number(response.time)
            : null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return Result.fail<PingResponse>(
        `ICMP ping failed: ${message}`
      );
    }
  }
}
