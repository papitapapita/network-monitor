// Source: src/infrastructure/service-enforcement/RouterOsQueueService.ts

jest.mock('node-routeros');

import { RouterOSAPI } from 'node-routeros';
import { RouterOsQueueService } from '../../../src/infrastructure/service-enforcement/RouterOsQueueService';
import { RouterConnection } from '../../../src/application/service-enforcement/interfaces';

const CONNECTION: RouterConnection = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret'
};

interface MockClient {
  connect: jest.Mock;
  write: jest.Mock;
  close: jest.Mock;
  connected: boolean;
}

function stubClient(): MockClient {
  const client: MockClient = {
    connect: jest.fn(),
    write: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    connected: false
  };
  client.connect.mockImplementation(async () => {
    client.connected = true;
    return client;
  });
  (RouterOSAPI as unknown as jest.Mock).mockImplementation(
    () => client
  );
  return client;
}

describe('RouterOsQueueService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSuspensionQueues', () => {
    it('should return only suspend-* queues with CIDR stripped from targets', async () => {
      const client = stubClient();
      client.write.mockResolvedValue([
        {
          '.id': '*1',
          name: 'suspend-abc',
          target: '10.20.30.40/32'
        },
        { '.id': '*2', name: 'plan-gold', target: '10.20.30.41/32' },
        { '.id': '*3', name: 'suspend-def', target: '10.9.9.9/32' }
      ]);

      const service = new RouterOsQueueService();
      const result = await service.listSuspensionQueues(CONNECTION);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([
        { name: 'suspend-abc', targetIp: '10.20.30.40' },
        { name: 'suspend-def', targetIp: '10.9.9.9' }
      ]);
      expect(client.write).toHaveBeenCalledWith(
        '/queue/simple/print'
      );
      expect(client.close).toHaveBeenCalled();
    });
  });

  describe('addSuspensionQueue', () => {
    it('should add a queue with /32 target and 1k/1k max-limit', async () => {
      const client = stubClient();
      client.write.mockResolvedValue([]);

      const service = new RouterOsQueueService();
      const result = await service.addSuspensionQueue(CONNECTION, {
        name: 'suspend-abc',
        targetIp: '10.20.30.40'
      });

      expect(result.isSuccess).toBe(true);
      expect(client.write).toHaveBeenCalledWith('/queue/simple/add', [
        '=name=suspend-abc',
        '=target=10.20.30.40/32',
        '=max-limit=1k/1k'
      ]);
    });
  });

  describe('removeSuspensionQueue', () => {
    it('should look up the queue id by name and remove it', async () => {
      const client = stubClient();
      client.write
        .mockResolvedValueOnce([
          {
            '.id': '*7',
            name: 'suspend-abc',
            target: '10.20.30.40/32'
          }
        ])
        .mockResolvedValueOnce([]);

      const service = new RouterOsQueueService();
      const result = await service.removeSuspensionQueue(
        CONNECTION,
        'suspend-abc'
      );

      expect(result.isSuccess).toBe(true);
      expect(client.write).toHaveBeenNthCalledWith(
        1,
        '/queue/simple/print',
        ['?name=suspend-abc']
      );
      expect(client.write).toHaveBeenNthCalledWith(
        2,
        '/queue/simple/remove',
        ['=.id=*7']
      );
    });

    it('should succeed without removing when the queue does not exist (idempotent)', async () => {
      const client = stubClient();
      client.write.mockResolvedValue([]);

      const service = new RouterOsQueueService();
      const result = await service.removeSuspensionQueue(
        CONNECTION,
        'suspend-gone'
      );

      expect(result.isSuccess).toBe(true);
      expect(client.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should fail when the connection cannot be established', async () => {
      const client = stubClient();
      client.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const service = new RouterOsQueueService();
      const result = await service.listSuspensionQueues(CONNECTION);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should fail and still close the client when a command throws', async () => {
      const client = stubClient();
      client.write.mockRejectedValue(
        new Error('!trap invalid command')
      );

      const service = new RouterOsQueueService();
      const result = await service.addSuspensionQueue(CONNECTION, {
        name: 'suspend-abc',
        targetIp: '10.20.30.40'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('RouterOS API error');
      expect(client.close).toHaveBeenCalled();
    });
  });
});
