// Source: src/application/device-monitoring/use-cases/RunPingToolUseCase.ts

import {
  DEFAULT_PING_TOOL_OPTIONS,
  PING_TOOL_AGENT_NOT_FOUND,
  PING_TOOL_BUSY,
  PING_TOOL_NEEDS_AGENT,
  RunPingToolUseCase
} from '../../../../src/application/device-monitoring/use-cases/RunPingToolUseCase';
import {
  IPingService,
  PingResponse
} from '../../../../src/application/device-monitoring/interfaces/IPingService';
import {
  AgentPingAnswer,
  IAgentPingProbe
} from '../../../../src/application/device-monitoring/interfaces/IAgentPingProbe';
import { IPingToolAgentQuery } from '../../../../src/application/device-monitoring/interfaces/IPingToolAgentQuery';
import {
  PingToolReplyDTO,
  PingToolStartDTO,
  RunPingToolDTO
} from '../../../../src/application/device-monitoring/dtos/PingToolDTO';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const AGENT_ID = '0b0f6c8e-6a0e-4d43-9b4e-2f4f3c1d9a10';
const FAST = { ...DEFAULT_PING_TOOL_OPTIONS, intervalMs: 0 };

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function reply(latencyMs: number): Result<PingResponse> {
  return Result.ok({ isReachable: true, latencyMs });
}

const noReply: Result<PingResponse> = Result.ok({
  isReachable: false,
  latencyMs: null
});

function measured(
  isReachable: boolean,
  latencyMs: number | null = null
): AgentPingAnswer {
  return {
    kind: 'measured',
    outcome: {
      kind: 'measured',
      isReachable,
      latencyMs,
      attempts: 1
    },
    measuredAt: new Date()
  };
}

describe('RunPingToolUseCase', () => {
  let pingService: jest.Mocked<IPingService>;
  let agentProbe: jest.Mocked<IAgentPingProbe>;
  let agents: jest.Mocked<IPingToolAgentQuery>;
  let useCase: RunPingToolUseCase;
  let starts: PingToolStartDTO[];
  let replies: PingToolReplyDTO[];

  function request(
    overrides: Partial<RunPingToolDTO> = {}
  ): RunPingToolDTO {
    return {
      ipAddress: '10.0.0.1',
      onStart: (start) => starts.push(start),
      onReply: (r) => replies.push(r),
      ...overrides
    };
  }

  function build(
    serverOnSite = true,
    options = FAST
  ): RunPingToolUseCase {
    return new RunPingToolUseCase(
      pingService,
      agentProbe,
      agents,
      makeLogger(),
      serverOnSite,
      options
    );
  }

  beforeEach(() => {
    pingService = { ping: jest.fn().mockResolvedValue(reply(5)) };
    agentProbe = {
      ping: jest.fn().mockResolvedValue(measured(true, 7))
    };
    agents = {
      findActive: jest
        .fn()
        .mockResolvedValue(
          Result.ok({ id: AGENT_ID, name: 'Torre Norte' })
        )
    };
    useCase = build();
    starts = [];
    replies = [];
  });

  describe('from the server', () => {
    it('pings 4 times by default, waiting 2 s for each reply', async () => {
      const result = await useCase.execute(request());

      expect(pingService.ping).toHaveBeenCalledTimes(4);
      expect(pingService.ping).toHaveBeenCalledWith(
        '10.0.0.1',
        2_000
      );
      expect(starts).toEqual([
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          source: 'SERVER',
          agentId: null,
          agentName: null,
          count: 4
        })
      ]);
      expect(replies.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
      expect(result.value).toMatchObject({
        sent: 4,
        received: 4,
        errors: 0,
        lossPercent: 0,
        cancelled: false,
        stoppedEarly: null
      });
      expect(agentProbe.ping).not.toHaveBeenCalled();
    });

    it('reports each reply and the loss, min, average and max', async () => {
      pingService.ping
        .mockResolvedValueOnce(reply(4))
        .mockResolvedValueOnce(noReply)
        .mockResolvedValueOnce(reply(10))
        .mockResolvedValueOnce(reply(7));

      const result = await useCase.execute(request());

      expect(replies.map((r) => [r.outcome, r.latencyMs])).toEqual([
        ['REPLY', 4],
        ['NO_REPLY', null],
        ['REPLY', 10],
        ['REPLY', 7]
      ]);
      expect(result.value).toMatchObject({
        sent: 4,
        received: 3,
        lossPercent: 25,
        minMs: 4,
        avgMs: 7,
        maxMs: 10
      });
    });

    it('reports a ping that could not run as an error, outside the loss', async () => {
      pingService.ping
        .mockResolvedValueOnce(Result.fail('spawn EAGAIN'))
        .mockResolvedValue(noReply);

      const result = await useCase.execute(request({ count: 2 }));

      expect(replies[0]).toMatchObject({
        outcome: 'ERROR',
        detail: 'Ping could not run: spawn EAGAIN'
      });
      expect(result.value).toMatchObject({
        sent: 1,
        received: 0,
        errors: 1,
        lossPercent: 100,
        minMs: null,
        avgMs: null,
        maxMs: null
      });
    });

    it('has no loss figure when no ping could be sent', async () => {
      pingService.ping.mockRejectedValue(new Error('boom'));

      const result = await useCase.execute(request({ count: 1 }));

      expect(replies[0].detail).toBe('Ping could not run: boom');
      expect(result.value.lossPercent).toBeNull();
    });

    it('refuses off site, since the server cannot reach the network', async () => {
      const result = await build(false).execute(request());

      expect(result.error).toBe(PING_TOOL_NEEDS_AGENT);
      expect(starts).toHaveLength(0);
    });

    it('waits the interval between pings', async () => {
      const slow = build(true, { ...FAST, intervalMs: 50 });
      const startedAt = Date.now();

      await slow.execute(request({ count: 3 }));

      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(90);
    });
  });

  describe('from an agent', () => {
    it('sends one single-attempt ping per line through the agent', async () => {
      agentProbe.ping
        .mockResolvedValueOnce(measured(true, 7))
        .mockResolvedValueOnce(measured(false));

      const result = await useCase.execute(
        request({ agentId: AGENT_ID, count: 2 })
      );

      expect(agentProbe.ping).toHaveBeenCalledWith(
        AGENT_ID,
        '10.0.0.1',
        1
      );
      expect(pingService.ping).not.toHaveBeenCalled();
      expect(starts[0]).toMatchObject({
        source: 'AGENT',
        agentId: AGENT_ID,
        agentName: 'Torre Norte'
      });
      expect(replies.map((r) => r.outcome)).toEqual([
        'REPLY',
        'NO_REPLY'
      ]);
      expect(result.value.lossPercent).toBe(50);
    });

    it('works off site', async () => {
      const result = await build(false).execute(
        request({ agentId: AGENT_ID, count: 1 })
      );

      expect(result.isSuccess).toBe(true);
    });

    it.each([
      ['AGENT_OFFLINE', 'The agent is not connected'],
      [
        'PROBE_UNSUPPORTED',
        'The agent must be updated to answer this request'
      ]
    ] as const)(
      'stops after the first ping when the agent is %s',
      async (reason, error) => {
        agentProbe.ping.mockResolvedValue({
          kind: 'refused',
          reason,
          error
        });

        const result = await useCase.execute(
          request({ agentId: AGENT_ID, count: 5 })
        );

        expect(agentProbe.ping).toHaveBeenCalledTimes(1);
        expect(replies).toEqual([
          expect.objectContaining({ outcome: 'ERROR', detail: error })
        ]);
        expect(result.value.stoppedEarly).toBe(error);
      }
    );

    it('keeps going after an agent timeout', async () => {
      agentProbe.ping
        .mockResolvedValueOnce({
          kind: 'refused',
          reason: 'TIMEOUT',
          error: 'The agent did not answer in time'
        })
        .mockResolvedValue(measured(true, 3));

      const result = await useCase.execute(
        request({ agentId: AGENT_ID, count: 3 })
      );

      expect(replies.map((r) => r.outcome)).toEqual([
        'ERROR',
        'REPLY',
        'REPLY'
      ]);
      expect(result.value.stoppedEarly).toBeNull();
    });

    it('reports a ping the agent could not run', async () => {
      agentProbe.ping.mockResolvedValue({
        kind: 'measured',
        outcome: {
          kind: 'probe-unavailable',
          error: 'EPERM',
          attempts: 1
        },
        measuredAt: new Date()
      });

      await useCase.execute(request({ agentId: AGENT_ID, count: 1 }));

      expect(replies[0]).toMatchObject({
        outcome: 'ERROR',
        detail: 'Ping could not run on the agent: EPERM'
      });
    });

    it('answers not found for an unknown or revoked agent', async () => {
      agents.findActive.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(
        request({ agentId: AGENT_ID })
      );

      expect(result.error).toBe(PING_TOOL_AGENT_NOT_FOUND);
      expect(agentProbe.ping).not.toHaveBeenCalled();
    });
  });

  describe('limits', () => {
    it.each([0, 101, 2.5])('rejects a count of %p', async (count) => {
      const result = await useCase.execute(request({ count }));

      expect(result.error).toBe('count must be between 1 and 100');
    });

    it('rejects something that is not an IP address', async () => {
      const result = await useCase.execute(
        request({ ipAddress: 'example.com; rm -rf /' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/^Invalid IP address format/);
      expect(pingService.ping).not.toHaveBeenCalled();
    });

    it('accepts IPv6', async () => {
      const result = await useCase.execute(
        request({ ipAddress: 'fe80::1', count: 1 })
      );

      expect(result.isSuccess).toBe(true);
      expect(pingService.ping).toHaveBeenCalledWith('fe80::1', 2_000);
    });

    it('refuses a run beyond the most allowed at once, then frees the slot', async () => {
      const limited = build(true, { ...FAST, maxRunning: 1 });
      let release!: () => void;
      pingService.ping.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(reply(1));
          })
      );

      const first = limited.execute(request({ count: 1 }));
      await new Promise((resolve) => setImmediate(resolve));
      const second = await limited.execute(request({ count: 1 }));
      release();
      await first;
      const third = await limited.execute(request({ count: 1 }));

      expect(second.error).toBe(PING_TOOL_BUSY);
      expect(third.isSuccess).toBe(true);
    });

    it('stops sending once the caller goes away', async () => {
      const abort = new AbortController();
      const slow = build(true, { ...FAST, intervalMs: 10_000 });

      const running = slow.execute(
        request({ count: 10, signal: abort.signal })
      );
      await new Promise((resolve) => setImmediate(resolve));
      abort.abort();
      const result = await running;

      expect(pingService.ping).toHaveBeenCalledTimes(1);
      expect(result.value.cancelled).toBe(true);
    });
  });
});
