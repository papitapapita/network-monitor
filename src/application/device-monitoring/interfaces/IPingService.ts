import { Result } from 'domain/shared/core';

export interface PingResponse {
  isReachable: boolean;
  latencyMs: number | null;
}

export interface IPingService {
  ping(
    ipAddress: string,
    timeoutMs?: number
  ): Promise<Result<PingResponse>>;
}
