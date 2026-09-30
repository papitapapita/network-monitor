import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaAgentRepository } from 'infrastructure/probe-agents/repositories';
import { NodeAgentSecretService } from 'infrastructure/probe-agents/crypto';
import { PrismaAgentDeviceCountQuery } from 'infrastructure/probe-agents/queries';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { EventDispatcher } from 'domain/shared/core';
import { IDomainEvent } from 'domain/shared/interfaces';
import {
  AgentCameBackEvent,
  AgentClockCorrectedEvent,
  AgentClockDriftedEvent,
  AgentWentOfflineEvent
} from 'domain/probe-agents/events';

export const BACKEND_URL = 'https://agents.test.local';

export function makeAdapters(prisma: PrismaClient) {
  return {
    repo: new PrismaAgentRepository(prisma),
    deviceCounts: new PrismaAgentDeviceCountQuery(prisma),
    secrets: new NodeAgentSecretService(),
    logger: new WinstonLogger()
  };
}

// Swaps the container's handlers — which would reach Telegram — for a
// recorder, so a suite sees exactly which agent-health events were
// dispatched after a save.
export function captureAgentHealthEvents(): IDomainEvent[] {
  const captured: IDomainEvent[] = [];
  EventDispatcher.clearHandlers();
  for (const name of [
    AgentWentOfflineEvent.name,
    AgentCameBackEvent.name,
    AgentClockDriftedEvent.name,
    AgentClockCorrectedEvent.name
  ]) {
    EventDispatcher.register(name, {
      handle: async (event: IDomainEvent) => {
        captured.push(event);
      }
    });
  }
  return captured;
}
