// Source: src/infrastructure/monitoring/routeros/RouterOsApiPrinter.ts

import {
  RouterOsApiPrinter,
  RouterOsSession
} from '../../../../src/infrastructure/monitoring/routeros/RouterOsApiPrinter';
import { RouterPortConnection } from '../../../../src/application/device-monitoring/interfaces';
import { MAX_ROUTEROS_PRINT_ROWS } from '../../../../src/agent/protocol';

const CONNECTION: RouterPortConnection = {
  host: '10.0.0.1',
  login: { username: 'admin', password: 'secret', apiPort: 8728 },
  agentId: null
};

type Answer = Record<string, unknown>[] | Error;

function makePrinter(answers: Record<string, Answer>) {
  const calls: string[] = [];
  const session: RouterOsSession & { closed: boolean } = {
    closed: false,
    async write(command) {
      calls.push(command);
      const answer = answers[command];
      if (!answer) throw new Error('no such command prefix');
      if (answer instanceof Error) throw answer;
      return answer;
    },
    async close() {
      session.closed = true;
    }
  };
  const printer = new RouterOsApiPrinter(
    undefined,
    async () => session
  );
  return { printer, session, calls };
}

describe('RouterOsApiPrinter', () => {
  it('[AGT-123] should answer each command in order and close', async () => {
    const { printer, session } = makePrinter({
      '/system/identity/print': [{ name: 'Core' }],
      '/system/resource/print': [{ uptime: '1d', 'cpu-load': '3' }]
    });

    const result = await printer.print(CONNECTION, [
      { command: '/system/identity/print', params: [] },
      { command: '/system/resource/print', params: [] }
    ]);

    expect(result.value).toEqual([
      { rows: [{ name: 'Core' }] },
      { rows: [{ uptime: '1d', 'cpu-load': '3' }] }
    ]);
    expect(session.closed).toBe(true);
  });

  it('[AGT-123] should answer a refused command with its error and keep going', async () => {
    const { printer, calls } = makePrinter({
      '/system/routerboard/print': new Error('no such command'),
      '/system/identity/print': [{ name: 'Core' }]
    });

    const result = await printer.print(CONNECTION, [
      { command: '/system/routerboard/print', params: [] },
      { command: '/system/identity/print', params: [] }
    ]);

    expect(result.value).toEqual([
      { error: 'no such command' },
      { rows: [{ name: 'Core' }] }
    ]);
    expect(calls).toHaveLength(2);
  });

  it('[AGT-123] should never send a command off the allow-list', async () => {
    const { printer, calls } = makePrinter({});

    const result = await printer.print(CONNECTION, [
      { command: '/system/reboot', params: [] }
    ]);

    expect(result.value).toEqual([
      { error: 'Command not allowed: /system/reboot' }
    ]);
    expect(calls).toEqual([]);
  });

  it('[AGT-123] should drop valueless words and cut long values', async () => {
    const { printer } = makePrinter({
      '/interface/print': [
        {
          name: 'ether1',
          comment: 'x'.repeat(2000),
          empty: undefined
        }
      ]
    });

    const result = await printer.print(CONNECTION, [
      { command: '/interface/print', params: [] }
    ]);

    const [answer] = result.value;
    expect('rows' in answer! && answer.rows[0]).toEqual({
      name: 'ether1',
      comment: 'x'.repeat(1024)
    });
  });

  it('[AGT-123] should refuse a command whose rows overflow the answer', async () => {
    const { printer } = makePrinter({
      '/ip/arp/print': Array.from(
        { length: MAX_ROUTEROS_PRINT_ROWS + 1 },
        () => ({ address: '10.0.0.2' })
      ),
      '/system/identity/print': [{ name: 'Core' }]
    });

    const result = await printer.print(CONNECTION, [
      { command: '/ip/arp/print', params: [] },
      { command: '/system/identity/print', params: [] }
    ]);

    expect(result.value).toEqual([
      { error: 'Too many rows to answer' },
      { rows: [{ name: 'Core' }] }
    ]);
  });

  it('[AGT-123] should refuse more commands than a request may carry', async () => {
    const { printer } = makePrinter({});

    const result = await printer.print(
      CONNECTION,
      Array.from({ length: 9 }, () => ({
        command: '/system/identity/print',
        params: []
      }))
    );

    expect(result.isFailure).toBe(true);
  });

  it('[AGT-123] should fail when the login fails', async () => {
    const printer = new RouterOsApiPrinter(undefined, async () => {
      throw new Error('cannot log in');
    });

    const result = await printer.print(CONNECTION, [
      { command: '/system/identity/print', params: [] }
    ]);

    expect(result.error).toBe('RouterOS API error: cannot log in');
  });

  it('[AGT-123] should give up on a router that stops answering', async () => {
    const session: RouterOsSession = {
      write: () => new Promise(() => undefined),
      close: async () => undefined
    };
    const printer = new RouterOsApiPrinter(
      undefined,
      async () => session,
      20
    );

    const result = await printer.print(CONNECTION, [
      { command: '/system/identity/print', params: [] }
    ]);

    expect(result.error).toBe(
      'RouterOS API error: no answer within 20 ms'
    );
  });
});
