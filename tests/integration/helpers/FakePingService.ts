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

  setResult(result: PingResponse): void {
    this._result = result;
  }

  async ping(
    _ipAddress: string,
    _timeoutMs?: number
  ): Promise<Result<PingResponse>> {
    return Result.ok(this._result);
  }
}
