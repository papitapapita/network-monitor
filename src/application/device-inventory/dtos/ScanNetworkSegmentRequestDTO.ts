export interface ScanNetworkSegmentRequestDTO {
  segment: string;
  // DEV-214: scan from this agent's PC; absent or null scans from the server.
  agentId?: string | null;
}
