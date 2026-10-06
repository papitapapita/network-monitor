import { Result } from 'domain/shared/core';
import {
  IRouterQueueService,
  RouterConnection,
  SuspensionQueue
} from 'application/service-enforcement/interfaces';
import {
  AgentEnforceRequest,
  IAgentEnforceChannel
} from 'application/probe-agents/interfaces';

export const ROUTER_NOT_BEHIND_AGENT =
  'The enforcement router is not behind an agent';

// Off site the server cannot reach the router, so every queue read and change
// goes through the agent the router device belongs to (SVC-070).
export class AgentRouterQueueService implements IRouterQueueService {
  constructor(private readonly channel: IAgentEnforceChannel) {}

  async listSuspensionQueues(
    connection: RouterConnection
  ): Promise<Result<SuspensionQueue[]>> {
    const answer = await this.ask(connection, { action: 'list' });
    return answer.isFailure
      ? Result.fail(answer.error)
      : Result.ok(answer.value ?? []);
  }

  async addSuspensionQueue(
    connection: RouterConnection,
    queue: SuspensionQueue
  ): Promise<Result<void>> {
    const answer = await this.ask(connection, {
      action: 'add',
      queue
    });
    return answer.isFailure ? Result.fail(answer.error) : Result.ok();
  }

  async removeSuspensionQueue(
    connection: RouterConnection,
    name: string
  ): Promise<Result<void>> {
    const answer = await this.ask(connection, {
      action: 'remove',
      name
    });
    return answer.isFailure ? Result.fail(answer.error) : Result.ok();
  }

  private async ask(
    connection: RouterConnection,
    request: AgentEnforceRequest
  ): Promise<Result<SuspensionQueue[] | null>> {
    if (!connection.agentId)
      return Result.fail(ROUTER_NOT_BEHIND_AGENT);
    const outcome = await this.channel.enforce(
      connection.agentId,
      connection,
      request
    );
    return outcome.ok
      ? Result.ok(outcome.queues)
      : Result.fail(outcome.error);
  }
}
