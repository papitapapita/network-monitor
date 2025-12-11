/**
 * PollingCycleSummaryDTO
 *
 * Summary statistics from executing a polling cycle.
 * Returned by ExecutePollingCycleUseCase.
 */
export interface PollingCycleSummaryDTO {
  /**
   * Total number of devices in the polling batch.
   */
  totalDevices: number;

  /**
   * Number of successful polls.
   */
  successful: number;

  /**
   * Number of failed polls (after all retries).
   */
  failed: number;

  /**
   * Number of skipped polls.
   */
  skipped: number;

  /**
   * Average response time across all successful polls in milliseconds.
   */
  averageResponseTime: number;

  /**
   * Minimum response time from all successful polls in milliseconds.
   */
  minResponseTime: number;

  /**
   * Maximum response time from all successful polls in milliseconds.
   */
  maxResponseTime: number;

  /**
   * Average packet loss percentage across all polls.
   */
  averagePacketLoss: number;

  /**
   * Total execution duration of the polling cycle in milliseconds.
   */
  executionDurationMs: number;
}
