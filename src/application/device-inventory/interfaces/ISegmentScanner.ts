import { Result } from 'domain/shared/core';
import { DiscoveredHost } from './INetworkScannerService';

// Starts the error of a scan the agent could not run: offline, too old,
// timed out or failed (DEV-214).
export const AGENT_SCAN_FAILED = 'The agent could not scan';

// Sweeps one segment from wherever it is reached: the server, or the probe
// agent that sits on it (DEV-212).
export interface ISegmentScanner {
  scan(
    cidr: string,
    agentId: string | null
  ): Promise<Result<DiscoveredHost[]>>;
}
