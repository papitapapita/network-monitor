import { Result } from 'domain/shared/core';
import { RouterTrafficSnapshotDTO } from '../dtos';

// Reads the main routers while someone watches (MON-062).
export interface IRouterTrafficMonitor {
  // Starts reading if it is not already, and answers what is known now.
  watch(): Promise<Result<RouterTrafficSnapshotDTO>>;
  stop(): Promise<void>;
}
