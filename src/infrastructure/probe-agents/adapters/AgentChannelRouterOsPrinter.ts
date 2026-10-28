import { Result } from 'domain/shared/core';
import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  IRouterOsPrinter,
  RouterOsCommand,
  RouterOsPrintAnswer,
  RouterPortConnection
} from 'application/device-monitoring/interfaces';

export const ROUTER_NOT_BEHIND_AGENT_FOR_PRINT =
  'The router is not behind an agent';

// AGT-123: off site the server cannot reach a router, so the agent it sits
// behind runs the commands.
export class AgentChannelRouterOsPrinter implements IRouterOsPrinter {
  constructor(private readonly channel: IAgentProbeChannel) {}

  async print(
    router: RouterPortConnection,
    commands: RouterOsCommand[]
  ): Promise<Result<RouterOsPrintAnswer[]>> {
    if (!router.agentId) {
      return Result.fail(ROUTER_NOT_BEHIND_AGENT_FOR_PRINT);
    }
    const answer = await this.channel.printRouterOs(
      router.agentId,
      router,
      commands
    );
    return answer.ok
      ? Result.ok(answer.reading)
      : Result.fail(answer.error);
  }
}
