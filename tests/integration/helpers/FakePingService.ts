import { Result } from 'domain/shared/core/Result';
import {
  IPingService,
  PingResponse
} from 'application/device-monitoring/interfaces/IPingService';

/**
 * Controllable stub for IPingService used in integration tests.
 * Call setResult() before each test to control what the ping returns.
 */
export class FakePingService implements IPingService {
  private _result: PingResponse = {
    isReachable: true,
    latencyMs: 10
  };

  private readonly byIp = new Map<string, PingResponse>();
  readonly pinged: { ipAddress: string; timeoutMs?: number }[] = [];

  setResult(result: PingResponse): void {
    this._result = result;
  }

  // Wins over setResult() for that one address.
  setResultFor(ipAddress: string, result: PingResponse): void {
    this.byIp.set(ipAddress, result);
  }

  async ping(
    ipAddress: string,
    timeoutMs?: number
  ): Promise<Result<PingResponse>> {
    this.pinged.push({ ipAddress, timeoutMs });
    return Result.ok(this.byIp.get(ipAddress) ?? this._result);
  }
}
