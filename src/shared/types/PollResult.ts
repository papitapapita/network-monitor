/**
 * Represents the result of a network polling operation.
 *
 * @property timestamp - The date and time when the poll was performed.
 * @property success - Indicates whether the poll was successful.
 * @property responseTimes - Optional array of response times (in milliseconds) for each attempt.
 * @property error - Optional error message if the poll failed.
 * @property packetLoss - Optional percentage of packet loss during the poll.
 * @property attempts - The number of polling attempts made.
 * @property minTime - Optional minimum response time recorded (in milliseconds).
 * @property maxTime - Optional maximum response time recorded (in milliseconds).
 * @property avgTime - Optional average response time recorded (in milliseconds).
 */
export interface PollResult {
  //apId: string;
  ipAddress: string;
  timestamp: Date;
  //method: "ICMP, SNMP, HTTP";
  status: boolean;
  success: boolean;
  responseTimes?: number[]; // in milliseconds
  error?: string;
  packetLoss?: number;
  attempts: number;
  minTime?: number;
  maxTime?: number;
  avgTime?: number;
}
