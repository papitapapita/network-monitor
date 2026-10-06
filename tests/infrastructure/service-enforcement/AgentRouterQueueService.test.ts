// Source: src/infrastructure/service-enforcement/AgentRouterQueueService.ts

import {
  AgentRouterQueueService,
  ROUTER_NOT_BEHIND_AGENT
} from '../../../src/infrastructure/service-enforcement/AgentRouterQueueService';
import type { IAgentEnforceChannel } from '../../../src/application/probe-agents/interfaces';

const ROUTER = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret',
  agentId: 'agent-1'
};

describe('AgentRouterQueueService', () => {
  let channel: jest.Mocked<IAgentEnforceChannel>;
  let service: AgentRouterQueueService;

  beforeEach(() => {
    channel = {
      enforce: jest.fn().mockResolvedValue({ ok: true, queues: null })
    };
    service = new AgentRouterQueueService(channel);
  });

  it("[SVC-070] lists the queues through the router's agent", async () => {
    channel.enforce.mockResolvedValue({
      ok: true,
      queues: [{ name: 'suspend-a', targetIp: '10.0.0.5' }]
    });

    const result = await service.listSuspensionQueues(ROUTER);

    expect(channel.enforce).toHaveBeenCalledWith('agent-1', ROUTER, {
      action: 'list'
    });
    expect(result.value).toEqual([
      { name: 'suspend-a', targetIp: '10.0.0.5' }
    ]);
  });

  it('[SVC-070] adds and removes through the agent', async () => {
    const queue = { name: 'suspend-b', targetIp: '10.0.0.6' };

    expect(
      (await service.addSuspensionQueue(ROUTER, queue)).isSuccess
    ).toBe(true);
    expect(
      (await service.removeSuspensionQueue(ROUTER, 'suspend-b'))
        .isSuccess
    ).toBe(true);
    expect(channel.enforce).toHaveBeenNthCalledWith(
      1,
      'agent-1',
      ROUTER,
      {
        action: 'add',
        queue
      }
    );
    expect(channel.enforce).toHaveBeenNthCalledWith(
      2,
      'agent-1',
      ROUTER,
      {
        action: 'remove',
        name: 'suspend-b'
      }
    );
  });

  it('[SVC-070] fails when the router belongs to no agent', async () => {
    const result = await service.listSuspensionQueues({
      ...ROUTER,
      agentId: null
    });

    expect(result.error).toBe(ROUTER_NOT_BEHIND_AGENT);
    expect(channel.enforce).not.toHaveBeenCalled();
  });

  it('passes on why the agent could not do it', async () => {
    channel.enforce.mockResolvedValue({
      ok: false,
      reason: 'AGENT_OFFLINE',
      error: 'The agent is not connected'
    });

    const result = await service.addSuspensionQueue(ROUTER, {
      name: 'suspend-c',
      targetIp: '10.0.0.7'
    });

    expect(result.error).toBe('The agent is not connected');
  });
});
