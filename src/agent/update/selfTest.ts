import { execFile } from 'child_process';
import { createPublicKey } from 'crypto';
import { AgentPlatform, RELEASE_PUBLIC_KEY } from 'agent/protocol';

export const SELF_TEST_FLAG = '--self-test';

const SELF_TEST_TIMEOUT_MS = 30_000;

// What `--self-test` checks before a new binary replaces the running one
// (AGT-081): it starts, its bundle loads, and it can still verify the next
// release. Returns the version to print.
export function selfTest(version: string): string {
  createPublicKey(RELEASE_PUBLIC_KEY);
  return version;
}

// Runs a downloaded binary's self-test; resolves to the version it printed.
export function runSelfTest(binary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      [SELF_TEST_FLAG],
      { timeout: SELF_TEST_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      }
    );
  });
}

// The release binary this agent runs as, or null where no release is built.
export function agentPlatform(
  platform: NodeJS.Platform,
  arch: string
): AgentPlatform | null {
  if (arch !== 'x64') return null;
  if (platform === 'win32') return 'win-x64';
  if (platform === 'linux') return 'linux-x64';
  return null;
}
