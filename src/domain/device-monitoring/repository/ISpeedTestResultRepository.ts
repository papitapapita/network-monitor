import { Result } from 'domain/shared/core';
import { SpeedTestResult } from '../entities';

export interface SpeedTestPageQuery {
  limit: number;
  offset: number;
}

export interface SpeedTestPage {
  results: SpeedTestResult[];
  total: number;
}

export interface ISpeedTestResultRepository {
  save(result: SpeedTestResult): Promise<Result<SpeedTestResult>>;
  // Newest first (MON-103).
  list(query: SpeedTestPageQuery): Promise<Result<SpeedTestPage>>;
}
