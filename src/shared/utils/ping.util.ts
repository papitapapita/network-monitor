import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Result of a ping operation.
 */
export interface PingResult {
  /** Whether the ping was successful */
  success: boolean;
  /** IP address that was pinged */
  ipAddress: string;
  /** Response time in milliseconds (if successful) */
  responseTime?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Ping utility for testing network device reachability.
 *
 * Uses ICMP ping to check if a device is reachable.
 * Non-blocking and has a configurable timeout.
 *
 * Note: This is a simple implementation for optional device creation validation.
 * For production polling, use the more robust PollingService with multi-ping support.
 *
 * @example
 * const result = await ping('192.168.1.1');
 * if (result.success) {
 *   console.log(`Device is reachable! Response time: ${result.responseTime}ms`);
 * } else {
 *   console.log(`Device is unreachable: ${result.error}`);
 * }
 */
export async function ping(
  ipAddress: string,
  timeoutMs: number = 5000
): Promise<PingResult> {
  try {
    // Determine ping command based on platform
    const isWindows = process.platform === 'win32';
    const pingCommand = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${ipAddress}` // Windows: -n count, -w timeout
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ipAddress}`; // Linux/Mac: -c count, -W timeout in seconds

    // Execute ping command
    const { stdout, stderr } = await execAsync(pingCommand, {
      timeout: timeoutMs + 1000 // Add buffer to command timeout
    });

    // Parse response time from output
    const responseTime = parseResponseTime(stdout, isWindows);

    return {
      success: true,
      ipAddress,
      responseTime
    };
  } catch (error) {
    // Ping failed (timeout, host unreachable, etc.)
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      success: false,
      ipAddress,
      error: errorMessage
    };
  }
}

/**
 * Parses response time from ping output.
 *
 * @param output - stdout from ping command
 * @param isWindows - whether running on Windows
 * @returns Response time in milliseconds, or undefined if not found
 */
function parseResponseTime(
  output: string,
  isWindows: boolean
): number | undefined {
  try {
    if (isWindows) {
      // Windows: "time=4ms" or "time<1ms"
      const match = output.match(/time[=<](\d+)ms/i);
      return match ? parseInt(match[1], 10) : undefined;
    } else {
      // Linux/Mac: "time=4.123 ms"
      const match = output.match(/time=(\d+\.?\d*)\s*ms/i);
      return match ? parseFloat(match[1]) : undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Pings multiple IP addresses in parallel.
 *
 * @param ipAddresses - Array of IP addresses to ping
 * @param timeoutMs - Timeout per ping in milliseconds
 * @returns Array of ping results
 *
 * @example
 * const results = await pingMultiple(['192.168.1.1', '192.168.1.2']);
 * results.forEach(result => {
 *   console.log(`${result.ipAddress}: ${result.success ? 'UP' : 'DOWN'}`);
 * });
 */
export async function pingMultiple(
  ipAddresses: string[],
  timeoutMs: number = 5000
): Promise<PingResult[]> {
  const pingPromises = ipAddresses.map((ip) => ping(ip, timeoutMs));
  return Promise.all(pingPromises);
}

/**
 * Checks if a device is reachable (simple boolean check).
 *
 * @param ipAddress - IP address to check
 * @param timeoutMs - Timeout in milliseconds
 * @returns true if device responds to ping, false otherwise
 *
 * @example
 * const isReachable = await isDeviceReachable('192.168.1.1');
 * console.log(isReachable ? 'Device is online' : 'Device is offline');
 */
export async function isDeviceReachable(
  ipAddress: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  const result = await ping(ipAddress, timeoutMs);
  return result.success;
}
