import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  AuthenticateAgentUseCase,
  INVALID_AGENT_TOKEN
} from 'application/probe-agents/use-cases';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanAgents, seedAgent } from '../../helpers/db';
import { makeAdapters } from './shared';

describe('AuthenticateAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AuthenticateAgentUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, secrets, logger } = makeAdapters(prisma);
    useCase = new AuthenticateAgentUseCase(repo, secrets, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-040] finds the active agent holding the token', async () => {
    const { id, token } = await seedAgent(prisma, {
      name: 'Torre Norte',
      status: 'ACTIVE'
    });

    const result = await useCase.execute({ token });

    expect(result.value).toEqual({
      agentId: id,
      agentName: 'Torre Norte'
    });
  });

  it('[AGT-040] rejects a token nobody holds', async () => {
    await seedAgent(prisma, { status: 'ACTIVE' });

    expect((await useCase.execute({ token: 'forged' })).error).toBe(
      INVALID_AGENT_TOKEN
    );
  });

  it('[AGT-005] rejects the token of an agent revoked since', async () => {
    const { token } = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.probeAgent.updateMany({
      data: {
        status: 'REVOKED',
        tokenHash: null,
        revokedAt: new Date()
      }
    });

    expect((await useCase.execute({ token })).error).toBe(
      INVALID_AGENT_TOKEN
    );
  });
});
