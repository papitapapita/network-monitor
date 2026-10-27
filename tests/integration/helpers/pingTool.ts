import { PrismaClient } from '../../../src/generated/prisma/client';
import { ILogger } from '../../../src/application/shared/interfaces';
import {
  AgentPingAnswer,
  IAgentPingProbe,
  IPingService
} from '../../../src/application/device-monitoring/interfaces';
import {
  DEFAULT_PING_TOOL_OPTIONS,
  RunPingToolUseCase
} from '../../../src/application/device-monitoring/use-cases';
import { PrismaPingToolAgentQuery } from '../../../src/infrastructure/monitoring/ping-tool';

// Answers for every agent as told; never talks to a real one.
export class FakeAgentPingProbe implements IAgentPingProbe {
  answer: AgentPingAnswer = {
    kind: 'measured',
    outcome: {
      kind: 'measured',
      isReachable: true,
      latencyMs: 12,
      attempts: 1
    },
    measuredAt: new Date()
  };
  readonly calls: { agentId: string; ipAddress: string }[] = [];

  async ping(
    agentId: string,
    ipAddress: string
  ): Promise<AgentPingAnswer> {
    this.calls.push({ agentId, ipAddress });
    return this.answer;
  }
}

// No pause between pings, so a run of several finishes at once.
export function buildPingTool(
  prisma: PrismaClient,
  pingService: IPingService,
  agentProbe: IAgentPingProbe,
  logger: ILogger,
  serverOnSite = true
): RunPingToolUseCase {
  return new RunPingToolUseCase(
    pingService,
    agentProbe,
    new PrismaPingToolAgentQuery(prisma),
    logger,
    serverOnSite,
    { ...DEFAULT_PING_TOOL_OPTIONS, intervalMs: 0 }
  );
}
