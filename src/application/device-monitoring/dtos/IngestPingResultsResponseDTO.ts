export type IngestPingResultsResponseDTO =
  | {
      status: 'APPLIED';
      isOnline: boolean;
      consecutiveFailures: number;
    }
  // monitoring was turned off after the result was measured
  | { status: 'SKIPPED' }
  | { status: 'PROBE_UNAVAILABLE' }
  // already stored under the same source id: nothing done (R8)
  | { status: 'DUPLICATE' }
  // stored as history; too old, or older than the last applied result, to
  // change the device's state or raise anything (R9, R10)
  | { status: 'HISTORY_ONLY' };
