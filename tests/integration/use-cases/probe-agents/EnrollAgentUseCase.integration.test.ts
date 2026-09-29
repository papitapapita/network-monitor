import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  EnrollAgentUseCase,
  INVALID_PAIRING_CODE
} from 'application/probe-agents/use-cases';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanAgents, seedAgent } from '../../helpers/db';
import { makeAdapters } from './shared';

describe('EnrollAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: EnrollAgentUseCase;
  let hash: (secret: string) => string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, secrets, logger } = makeAdapters(prisma);
    hash = (s) => secrets.hash(s);
    useCase = new EnrollAgentUseCase(repo, secrets, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-003] activates the agent and stores only the token hash', async () => {
    const { id, pairingCode } = await seedAgent(prisma);

    const result = await useCase.execute({ pairingCode });

    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.status).toBe('ACTIVE');
    expect(row!.tokenHash).toBe(hash(result.value.token));
    expect(row!.pairingCodeHash).toBeNull();
    expect(row!.enrolledAt).not.toBeNull();
  });

  it('[AGT-002] a second enrollment with the same code is refused', async () => {
    const { pairingCode } = await seedAgent(prisma);
    const first = await useCase.execute({ pairingCode });

    const second = await useCase.execute({ pairingCode });

    expect(first.isSuccess).toBe(true);
    expect(second.error).toBe(INVALID_PAIRING_CODE);
  });

  it('[AGT-002] only one of two simultaneous enrollments wins', async () => {
    const { id, pairingCode } = await seedAgent(prisma);

    const results = await Promise.all([
      useCase.execute({ pairingCode }),
      useCase.execute({ pairingCode })
    ]);

    const winners = results.filter((r) => r.isSuccess);
    expect(winners).toHaveLength(1);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.tokenHash).toBe(hash(winners[0].value.token));
  });

  it('[AGT-001] refuses an expired code and leaves the agent PENDING', async () => {
    const { id, pairingCode } = await seedAgent(prisma, {
      pairingExpiresAt: new Date(Date.now() - 1_000)
    });

    const result = await useCase.execute({ pairingCode });

    expect(result.error).toBe(INVALID_PAIRING_CODE);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.status).toBe('PENDING');
  });

  it('[AGT-008] refuses an unknown code with the same answer', async () => {
    const result = await useCase.execute({
      pairingCode: 'never-issued'
    });

    expect(result.error).toBe(INVALID_PAIRING_CODE);
  });
});
