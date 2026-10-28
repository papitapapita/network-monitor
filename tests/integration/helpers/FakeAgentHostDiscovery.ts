import { Result } from 'domain/shared/core';
import {
  AgentScannedHost,
  IAgentHostDiscovery
} from 'application/device-inventory/interfaces';

// Stands in for an agent's discover request (DEV-214): setHosts() is what
// the agent answers, failWith() why it could not.
export class FakeAgentHostDiscovery implements IAgentHostDiscovery {
  private hosts: AgentScannedHost[] = [];
  private error: string | null = null;
  public calls: Array<{ agentId: string; cidr: string }> = [];

  setHosts(hosts: AgentScannedHost[]): void {
    this.hosts = hosts;
  }

  failWith(error: string): void {
    this.error = error;
  }

  reset(): void {
    this.hosts = [];
    this.error = null;
    this.calls = [];
  }

  async discover(
    agentId: string,
    cidr: string
  ): Promise<Result<AgentScannedHost[]>> {
    this.calls.push({ agentId, cidr });
    return this.error === null
      ? Result.ok(this.hosts)
      : Result.fail(this.error);
  }
}
