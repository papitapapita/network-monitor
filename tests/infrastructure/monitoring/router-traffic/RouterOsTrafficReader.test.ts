// Source: src/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.ts

jest.mock('node-routeros');

import { EventEmitter } from 'events';
import { RouterOSAPI } from 'node-routeros';
import { RouterOsTrafficReader } from '../../../../src/infrastructure/monitoring/router-traffic/RouterOsTrafficReader';
import { RouterConnectionTarget } from '../../../../src/application/device-monitoring/interfaces';

const ROUTER: RouterConnectionTarget = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret',
  agentId: null
};

type MockClient = EventEmitter & {
  connect: jest.Mock;
  write: jest.Mock;
  close: jest.Mock;
  connected: boolean;
};

function stubClients(
  interfaces = [
    { name: 'ether1-wan', type: 'ether', running: 'true' },
    { name: 'bridge-lan', type: 'bridge', running: 'false' }
  ]
): MockClient[] {
  const made: MockClient[] = [];
  (RouterOSAPI as unknown as jest.Mock).mockImplementation(() => {
    const client = Object.assign(new EventEmitter(), {
      connect: jest.fn(),
      write: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      connected: false
    }) as MockClient;
    client.connect.mockImplementation(async () => {
      client.connected = true;
      return client;
    });
    client.write.mockImplementation(async (command: string) =>
      command === '/interface/print'
        ? interfaces
        : [
            {
              name: 'ether1-wan',
              'rx-bits-per-second': '120000000',
              'tx-bits-per-second': '15000000'
            },
            {
              name: 'bridge-lan',
              'rx-bits-per-second': '0',
              'tx-bits-per-second': '0'
            }
          ]
    );
    made.push(client);
    return client;
  });
  return made;
}

describe('RouterOsTrafficReader', () => {
  let now: number;
  let reader: RouterOsTrafficReader;

  beforeEach(() => {
    now = 1_000_000;
    reader = new RouterOsTrafficReader(
      undefined,
      { readTimeoutMs: 1_000, idleCloseMs: 30_000 },
      () => now
    );
  });

  afterEach(async () => {
    await reader.releaseAll();
    jest.clearAllMocks();
  });

  it('[MON-063] reads the rate of every static, enabled interface', async () => {
    const clients = stubClients();

    const result = await reader.read(ROUTER);

    const [client] = clients;
    expect(result.value).toEqual([
      {
        name: 'ether1-wan',
        type: 'ether',
        running: true,
        rxBps: 120_000_000,
        txBps: 15_000_000
      },
      {
        name: 'bridge-lan',
        type: 'bridge',
        running: false,
        rxBps: 0,
        txBps: 0
      }
    ]);
    expect(client.write).toHaveBeenCalledWith('/interface/print', [
      '?disabled=false',
      '?dynamic=false',
      '=.proplist=name,type,running'
    ]);
    expect(client.write).toHaveBeenCalledWith(
      '/interface/monitor-traffic',
      ['=interface=ether1-wan,bridge-lan', '=once=']
    );
  });

  it('[MON-064] logs in once and keeps the login for the next read', async () => {
    const clients = stubClients();

    await reader.read(ROUTER);
    await reader.read(ROUTER);
    await reader.read(ROUTER);

    expect(clients).toHaveLength(1);
    expect(clients[0].connect).toHaveBeenCalledTimes(1);
  });

  it('[MON-064] closes every login when released', async () => {
    const clients = stubClients();
    await reader.read(ROUTER);

    await reader.releaseAll();

    expect(clients[0].close).toHaveBeenCalled();
  });

  it('drops a login whose read failed, so the next read logs in again', async () => {
    const clients = stubClients();
    await reader.read(ROUTER);
    clients[0].write.mockRejectedValueOnce(
      new Error('connection reset')
    );

    const failed = await reader.read(ROUTER);
    await reader.read(ROUTER);

    expect(failed.error).toBe('RouterOS API error: connection reset');
    expect(clients[0].close).toHaveBeenCalled();
    expect(clients).toHaveLength(2);
  });

  it('answers an error when the login is refused', async () => {
    const clients = stubClients();
    (RouterOSAPI as unknown as jest.Mock).mockImplementationOnce(
      () => {
        const client = Object.assign(new EventEmitter(), {
          connect: jest
            .fn()
            .mockRejectedValue(
              new Error('invalid user name or password')
            ),
          write: jest.fn(),
          close: jest.fn(),
          connected: false
        });
        clients.push(client as unknown as MockClient);
        return client;
      }
    );

    const result = await reader.read(ROUTER);

    expect(result.error).toBe(
      'RouterOS API error: invalid user name or password'
    );
  });

  it('survives a dropped socket and logs in again on the next read', async () => {
    const clients = stubClients();
    await reader.read(ROUTER);

    clients[0].emit('error', new Error('socket timeout'));
    await reader.read(ROUTER);

    expect(clients).toHaveLength(2);
  });

  it('answers an error for a router that never answers', async () => {
    const clients = stubClients();
    await reader.read(ROUTER);
    clients[0].write.mockImplementation(
      () => new Promise(() => undefined)
    );

    const result = await reader.read(ROUTER);

    expect(result.error).toBe(
      'RouterOS API error: no answer within 1000 ms'
    );
  });

  it('[MON-063] asks for no rates when the router has no static interface', async () => {
    const clients = stubClients([]);

    const result = await reader.read(ROUTER);

    expect(result.value).toEqual([]);
    expect(clients[0].write).toHaveBeenCalledTimes(1);
  });
});
