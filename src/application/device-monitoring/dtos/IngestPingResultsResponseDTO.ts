export type IngestPingResultsResponseDTO =
  | {
      status: 'APPLIED';
      isOnline: boolean;
      consecutiveFailures: number;
    }
  // monitoring was turned off after the result was measured
  | { status: 'SKIPPED' }
  | { status: 'PROBE_UNAVAILABLE' };
