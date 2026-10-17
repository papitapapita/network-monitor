import { Result } from 'domain/shared/core';
import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  InterfaceTrafficReading,
  IRouterTrafficReader,
  RouterConnectionTarget
} from 'application/device-monitoring/interfaces';

export const ROUTER_NOT_BEHIND_AGENT_FOR_TRAFFIC =
  'The router is not behind an agent';

// MON-065: off site the server cannot reach a router, so its traffic is read
// by the agent it sits behind, which also keeps the login open (AGT-118).
export class AgentChannelTrafficReader
  implements IRouterTrafficReader
{
  constructor(private readonly channel: IAgentProbeChannel) {}

  async read(
    router: RouterConnectionTarget
  ): Promise<Result<InterfaceTrafficReading[]>> {
    if (!router.agentId) {
      return Result.fail(ROUTER_NOT_BEHIND_AGENT_FOR_TRAFFIC);
    }
    const answer = await this.channel.readTraffic(
      router.agentId,
      router
    );
    return answer.ok
      ? Result.ok(answer.reading)
      : Result.fail(answer.error);
  }

  // the agent closes a login nobody reads within its idle limit
  async releaseAll(): Promise<void> {}
}
