import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

// The short numbers that stand for devices on the wire (ADR 0002, R19).
export interface IAgentDeviceIndex {
  // The index of each device for this agent, assigning a fresh one to any
  // device that has none yet. An index never changes and is never reused.
  indexesFor(
    agentId: AgentId,
    deviceIds: string[]
  ): Promise<Result<Map<string, number>>>;

  // Back from indexes to devices, keeping only devices this agent is still
  // assigned to: a result for a device moved elsewhere has no home here.
  resolveAssigned(
    agentId: AgentId,
    indexes: number[]
  ): Promise<Result<Map<number, string>>>;
}
