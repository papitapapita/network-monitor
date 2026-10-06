// Source: src/agent/enforce/EnforceRunner.ts

import { Result } from '../../../src/domain/shared/core';
import { EnforceRunner } from '../../../src/agent/enforce/EnforceRunner';
import type { IRouterQueueService } from '../../../src/application/service-enforcement/interfaces';
import type { EnforceRequestMessage } from '../../../src/agent/protocol';
import { silentLogger } from '../helpers';

const ROUTER = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret'
};

function request(
  extra: Partial<EnforceRequestMessage> & { action: string }
): EnforceRequestMessage {
  return {
    type: 'enforce',
    requestId: 'e-1',
    router: ROUTER,
    ...extra
  } as EnforceRequestMessage;
}

describe('EnforceRunner', () => {
  let queues: jest.Mocked<IRouterQueueService>;
  let runner: EnforceRunner;

  beforeEach(() => {
    queues = {
      listSuspensionQueues: jest
        .fn()
        .mockResolvedValue(
          Result.ok([{ name: 'suspend-a', targetIp: '10.0.0.5' }])
        ),
      addSuspensionQueue: jest.fn().mockResolvedValue(Result.ok()),
      removeSuspensionQueue: jest.fn().mockResolvedValue(Result.ok())
    };
    runner = new EnforceRunner(queues, silentLogger());
  });

  it('[AGT-111] answers a list with the router queues', async () => {
    const answer = await runner.run(request({ action: 'list' }));

    expect(queues.listSuspensionQueues).toHaveBeenCalledWith(ROUTER);
    expect(answer).toEqual({
      type: 'enforce.result',
      requestId: 'e-1',
      queues: [{ name: 'suspend-a', targetIp: '10.0.0.5' }]
    });
  });

  it('[AGT-111] adds and removes a queue', async () => {
    const queue = { name: 'suspend-b', targetIp: '10.0.0.6' };

    const added = await runner.run(request({ action: 'add', queue }));
    const removed = await runner.run(
      request({ action: 'remove', name: 'suspend-b' })
    );

    expect(queues.addSuspensionQueue).toHaveBeenCalledWith(
      ROUTER,
      queue
    );
    expect(queues.removeSuspensionQueue).toHaveBeenCalledWith(
      ROUTER,
      'suspend-b'
    );
    expect(added).toMatchObject({ queues: null });
    expect(removed).toMatchObject({ queues: null });
  });

  it('[AGT-111] passes on why the router refused', async () => {
    queues.listSuspensionQueues.mockResolvedValue(
      Result.fail('Login failed')
    );

    expect(await runner.run(request({ action: 'list' }))).toEqual({
      type: 'enforce.result',
      requestId: 'e-1',
      error: 'Login failed'
    });
  });

  it('answers a thrown error instead of dropping the request', async () => {
    queues.addSuspensionQueue.mockRejectedValue(
      new Error('ECONNRESET')
    );

    const answer = await runner.run(
      request({
        action: 'add',
        queue: { name: 'suspend-c', targetIp: '10.0.0.7' }
      })
    );

    expect(answer).toMatchObject({ error: 'ECONNRESET' });
  });

  it('[AGT-111] runs one request at a time', async () => {
    let inFlight = 0;
    let most = 0;
    queues.addSuspensionQueue.mockImplementation(async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return Result.ok();
    });

    await Promise.all(
      [1, 2, 3].map((n) =>
        runner.run(
          request({
            action: 'add',
            queue: { name: `suspend-${n}`, targetIp: `10.0.0.${n}` }
          })
        )
      )
    );

    expect(most).toBe(1);
  });

  it('keeps going after a request that failed', async () => {
    queues.listSuspensionQueues
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(Result.ok([]));

    await runner.run(request({ action: 'list' }));
    const second = await runner.run(request({ action: 'list' }));

    expect(second).toMatchObject({ queues: [] });
  });
});
