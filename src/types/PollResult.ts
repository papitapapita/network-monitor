export interface PollResult {
  timestamp: Date;
  success: boolean;
  responseTimes?: number[]; // in milliseconds
  error?: string;
  packetLoss?: number;
  attempts: number;
  minTime?: number;
  maxTime?: number;
  avgTime?: number;
}
