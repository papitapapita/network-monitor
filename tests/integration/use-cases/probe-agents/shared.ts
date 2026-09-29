import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaAgentRepository } from 'infrastructure/probe-agents/repositories';
import { NodeAgentSecretService } from 'infrastructure/probe-agents/crypto';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

export const BACKEND_URL = 'https://agents.test.local';

export function makeAdapters(prisma: PrismaClient) {
  return {
    repo: new PrismaAgentRepository(prisma),
    secrets: new NodeAgentSecretService(),
    logger: new WinstonLogger()
  };
}
