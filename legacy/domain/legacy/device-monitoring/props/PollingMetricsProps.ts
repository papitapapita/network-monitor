export interface PollingMetricsProps {
  responseTimes: number[]; // Response times in milliseconds for successful pings
  totalPings: number; // Total number of pings attempted
  successfulPings: number; // Number of successful pings (length of responseTimes)
  averageResponseTime: number; // Calculated average in ms
  minResponseTime: number; // Minimum response time in ms
  maxResponseTime: number; // Maximum response time in ms
  jitter: number; // Standard deviation of response times
  packetLoss: number; // Packet loss percentage (0-100)
}
