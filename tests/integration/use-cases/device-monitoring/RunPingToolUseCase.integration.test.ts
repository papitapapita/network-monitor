import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  PING_TOOL_AGENT_NOT_FOUND,
  PING_TOOL_NEEDS_AGENT
} from 'application/device-monitoring/use-cases/RunPingToolUseCase';
import {
  PingToolReplyDTO,
  PingToolStartDTO,
  RunPingToolDTO
} from 'application/device-monitoring/dtos';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedAgent } from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';
import {
  buildPingTool,
  FakeAgentPingProbe
} from '../../helpers/pingTool';

describe('RunPingToolUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let ping: FakePingService;
  let agentProbe: FakeAgentPingProbe;
  let starts: PingToolStartDTO[];
  let replies: PingToolReplyDTO[];

  function request(
    overrides: Partial<RunPingToolDTO> = {}
  ): RunPingToolDTO {
    return {
      ipAddress: '10.70.0.1',
      count: 2,
      onStart: (start) => starts.push(start),
      onReply: (reply) => replies.push(reply),
      ...overrides
    };
  }

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    ping = new FakePingService();
    agentProbe = new FakeAgentPingProbe();
    starts = [];
    replies = [];
  });

  it('pings from the server and writes nothing', async () => {
    const pingRowsBefore = await prisma.pingResult.count();

    const result = await buildPingTool(
      prisma,
      ping,
      agentProbe,
      new WinstonLogger()
    ).execute(request());

    expect(result.value).toMatchObject({ sent: 2, received: 2 });
    expect(ping.pinged.map((p) => p.ipAddress)).toEqual([
      '10.70.0.1',
      '10.70.0.1'
    ]);
    expect(await prisma.pingResult.count()).toBe(pingRowsBefore);
  });

  it('names the active agent it pings from', async () => {
    const agent = await seedAgent(prisma, {
      name: 'Torre Norte',
      status: 'ACTIVE'
    });

    await buildPingTool(
      prisma,
      ping,
      agentProbe,
      new WinstonLogger(),
      false
    ).execute(request({ agentId: agent.id }));

    expect(starts[0]).toMatchObject({
      source: 'AGENT',
      agentId: agent.id,
      agentName: 'Torre Norte'
    });
    expect(agentProbe.calls).toHaveLength(2);
    expect(ping.pinged).toHaveLength(0);
  });

  it.each(['PENDING', 'REVOKED'] as const)(
    'refuses an agent that is %s',
    async (status) => {
      const agent = await seedAgent(prisma, { status });

      const result = await buildPingTool(
        prisma,
        ping,
        agentProbe,
        new WinstonLogger()
      ).execute(request({ agentId: agent.id }));

      expect(result.error).toBe(PING_TOOL_AGENT_NOT_FOUND);
      expect(agentProbe.calls).toHaveLength(0);
    }
  );

  it('refuses an agent id that does not exist', async () => {
    const result = await buildPingTool(
      prisma,
      ping,
      agentProbe,
      new WinstonLogger()
    ).execute(
      request({ agentId: '0b0f6c8e-6a0e-4d43-9b4e-2f4f3c1d9a10' })
    );

    expect(result.error).toBe(PING_TOOL_AGENT_NOT_FOUND);
  });

  it('needs an agent when the server is off site', async () => {
    const result = await buildPingTool(
      prisma,
      ping,
      agentProbe,
      new WinstonLogger(),
      false
    ).execute(request());

    expect(result.error).toBe(PING_TOOL_NEEDS_AGENT);
    expect(ping.pinged).toHaveLength(0);
  });
});
