// Source: src/infrastructure/device-backups/fetchers/SshCommandClient.ts

import { AddressInfo } from 'net';
import { Server, utils } from 'ssh2';
import { SshCommandClient } from '../../../../src/infrastructure/device-backups/fetchers';

const LOGIN = { username: 'admin', password: 'secret' };

// A local SSH server standing in for the router: it accepts LOGIN and
// answers each command with `answer(command)`.
async function startServer(
  answer: (command: string) => string | null
): Promise<{ port: number; commands: string[]; close: () => void }> {
  const commands: string[] = [];
  const hostKey = utils.generateKeyPairSync('ed25519').private;
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client
      .on('authentication', (ctx) => {
        if (
          ctx.method === 'password' &&
          ctx.username === LOGIN.username &&
          ctx.password === LOGIN.password
        )
          return ctx.accept();
        ctx.reject(['password']);
      })
      .on('session', (accept) => {
        accept().once('exec', (acceptExec, _reject, info) => {
          commands.push(info.command);
          const stream = acceptExec();
          const output = answer(info.command);
          if (output === null) return;
          stream.write(output);
          stream.exit(0);
          stream.end();
        });
      })
      .on('error', () => undefined);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', resolve)
  );
  return {
    port: (server.address() as AddressInfo).port,
    commands,
    close: () => server.close()
  };
}

describe('SshCommandClient', () => {
  let close: (() => void) | undefined;

  afterEach(() => close?.());

  it('[BKP-054] should return what the command printed', async () => {
    const server = await startServer((command) =>
      command === '/export'
        ? '/ip address\r\nadd address=10.0.0.1/24\r\n'
        : ''
    );
    close = server.close;

    const result = await new SshCommandClient().run(
      '127.0.0.1',
      server.port,
      LOGIN,
      '/export'
    );

    expect(result.value).toBe(
      '/ip address\r\nadd address=10.0.0.1/24\r\n'
    );
    expect(server.commands).toEqual(['/export']);
  });

  it('[BKP-055] should say the login was rejected', async () => {
    const server = await startServer(() => '');
    close = server.close;

    const result = await new SshCommandClient().run(
      '127.0.0.1',
      server.port,
      { username: 'admin', password: 'wrong' },
      '/export'
    );

    expect(result.error).toBe(
      'SSH login rejected: check the device username and password'
    );
  });

  it('should say the port refused the connection', async () => {
    const server = await startServer(() => '');
    server.close();

    const result = await new SshCommandClient().run(
      '127.0.0.1',
      server.port,
      LOGIN,
      '/export'
    );

    expect(result.error).toBe(
      `SSH connection refused on port ${server.port}`
    );
  });

  it('should stop a device that answers more than the limit', async () => {
    const server = await startServer(() => 'x'.repeat(5_000));
    close = server.close;

    const result = await new SshCommandClient({
      maxOutputBytes: 1_000
    }).run('127.0.0.1', server.port, LOGIN, '/export');

    expect(result.error).toBe(
      "The device's answer exceeds 1000 bytes"
    );
  });

  it('should give up on a command that never finishes', async () => {
    const server = await startServer(() => null);
    close = server.close;

    const result = await new SshCommandClient({ timeoutMs: 200 }).run(
      '127.0.0.1',
      server.port,
      LOGIN,
      '/export'
    );

    expect(result.error).toBe('SSH timed out after 0.2s');
  });
});
