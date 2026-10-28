import { Result } from 'domain/shared/core';
import { DiscoveredHost } from './INetworkScannerService';

// Sweeps one segment from wherever it is reached: the server, or the probe
// agent that sits on it (DEV-212).
export interface ISegmentScanner {
  scan(
    cidr: string,
    agentId: string | null
  ): Promise<Result<DiscoveredHost[]>>;
}
