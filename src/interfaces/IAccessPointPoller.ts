import { PollResult } from '../types';

export interface IAccessPointPoller {
  start(): void;
  stop(): Promise<void>;
  getResults(): PollResult[];
  getLastResult(): PollResult | undefined;
  getStats(): {
    totalPingsBatches: number;
    successfulPings: number;
    failedPings: number;
    avgPacketLoss: number;
    averageResponseTime?: number;
    minResponseTime?: number;
    maxResponseTime?: number;
  } | null;
  clearResults(): void;
  isRunning(): boolean;
  getConfiguration(): {
    ipAddress: string;
    frequency: number;
    timeout: number;
    maxRetries: number;
  };
  setConfiguration(config: {
    ipAddress?: string;
    frequency?: number;
    timeout?: number;
    maxRetries?: number;
  }): void;
}
