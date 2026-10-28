import { Result } from 'domain/shared/core';
import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  IRouterPortReader,
  RouterPortConnection,
  RouterPortsReading
} from 'application/device-monitoring/interfaces';

export const ROUTER_NOT_BEHIND_AGENT_FOR_PORTS =
  'The router is not behind an agent';

// MON-145: off site the server cannot reach a router, so its ports are read
// by the agent it sits behind (AGT-122).
export class AgentChannelPortReader implements IRouterPortReader {
  constructor(private readonly channel: IAgentProbeChannel) {}

  async read(
    router: RouterPortConnection
  ): Promise<Result<RouterPortsReading>> {
    if (!router.agentId) {
      return Result.fail(ROUTER_NOT_BEHIND_AGENT_FOR_PORTS);
    }
    const answer = await this.channel.readPorts(
      router.agentId,
      router
    );
    return answer.ok
      ? Result.ok(answer.reading)
      : Result.fail(answer.error);
  }
}
