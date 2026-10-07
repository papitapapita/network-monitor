import { Client, KexAlgorithm } from 'ssh2';
import { Result } from 'domain/shared/core';

export interface SshLogin {
  username: string;
  password: string;
}

export interface SshCommandClientOptions {
  // Until logged in.
  connectTimeoutMs?: number;
  // From connecting to the end of the answer.
  timeoutMs?: number;
  maxOutputBytes?: number;
}

// RouterOS 6 offers only SHA-1 key exchanges, which ssh2 keeps off by
// default; the newest ones stay first.
const LEGACY_KEX: KexAlgorithm[] = [
  'diffie-hellman-group14-sha1',
  'diffie-hellman-group-exchange-sha1'
];

// Runs one command on a device over SSH with its password and returns what
// it printed. The device's host key is not checked: nothing pins it, and the
// devices are reached on the ISP's own network (BKP-055).
export class SshCommandClient {
  private readonly connectTimeoutMs: number;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options: SshCommandClientOptions = {}) {
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 1_000_000;
  }

  run(
    host: string,
    port: number,
    login: SshLogin,
    command: string
  ): Promise<Result<string>> {
    return new Promise((resolve) => {
      const connection = new Client();
      let settled = false;
      const finish = (result: Result<string>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        connection.end();
        resolve(result);
      };
      // The handshake timeout alone would let a device that never finishes
      // printing hold the run forever.
      const timer = setTimeout(
        () =>
          finish(
            Result.fail(
              `SSH timed out after ${this.timeoutMs / 1000}s`
            )
          ),
        this.timeoutMs
      );

      connection.on('ready', () => {
        connection.exec(command, (error, stream) => {
          if (error)
            return finish(
              Result.fail(`SSH command failed: ${error.message}`)
            );
          const chunks: Buffer[] = [];
          let size = 0;
          const collect = (data: Buffer) => {
            size += data.length;
            if (size > this.maxOutputBytes)
              return finish(
                Result.fail(
                  `The device's answer exceeds ${this.maxOutputBytes} bytes`
                )
              );
            chunks.push(data);
          };
          stream.on('data', collect);
          stream.stderr.on('data', collect);
          stream.on('close', () =>
            finish(Result.ok(Buffer.concat(chunks).toString('utf8')))
          );
        });
      });
      connection.on(
        'keyboard-interactive',
        (_n, _i, _l, prompts, reply) =>
          reply(prompts.map(() => login.password))
      );
      connection.on('error', (error) =>
        finish(Result.fail(SshCommandClient.describe(error, port)))
      );
      connection.on('close', () =>
        finish(Result.fail('SSH connection closed before the answer'))
      );

      connection.connect({
        host,
        port,
        username: login.username,
        password: login.password,
        tryKeyboard: true,
        readyTimeout: this.connectTimeoutMs,
        algorithms: {
          kex: { append: LEGACY_KEX, prepend: [], remove: [] }
        }
      });
    });
  }

  private static describe(
    error: Error & { level?: string; code?: string },
    port: number
  ): string {
    if (error.level === 'client-authentication')
      return 'SSH login rejected: check the device username and password';
    if (error.code === 'ECONNREFUSED')
      return `SSH connection refused on port ${port}`;
    if (/handshake/i.test(error.message))
      return 'SSH did not answer in time';
    return `SSH error: ${error.message}`;
  }
}
