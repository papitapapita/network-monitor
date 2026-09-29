import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  EnrollAgentUseCase,
  INVALID_PAIRING_CODE,
  ReissuePairingKeyUseCase
} from 'application/probe-agents/use-cases';
import { parsePairingKey } from 'agent/protocol';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  seedAgent,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { BACKEND_URL, makeAdapters } from './shared';

describe('ReissuePairingKeyUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ReissuePairingKeyUseCase;
  let enroll: EnrollAgentUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, secrets, logger } = makeAdapters(prisma);
    useCase = new ReissuePairingKeyUseCase(
      repo,
      secrets,
      BACKEND_URL,
      logger
    );
    enroll = new EnrollAgentUseCase(repo, secrets, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-004] revives an expired agent with a new key; the old code is dead', async () => {
    const { id, pairingCode: oldCode } = await seedAgent(prisma, {
      pairingExpiresAt: new Date(Date.now() - 1_000)
    });

    const result = await useCase.execute({ id });

    const { pairingCode } = parsePairingKey(result.value.pairingKey)!;
    expect(
      (await enroll.execute({ pairingCode: oldCode })).error
    ).toBe(INVALID_PAIRING_CODE);
    expect((await enroll.execute({ pairingCode })).isSuccess).toBe(
      true
    );
  });

  it('[AGT-004] refuses an active agent', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    const result = await useCase.execute({ id });

    expect(result.error).toContain('Only a pending agent');
  });

  it('fails for an unknown agent', async () => {
    expect((await useCase.execute({ id: GHOST_ID })).error).toContain(
      'not found'
    );
  });

  it('fails on a malformed id', async () => {
    expect(
      (await useCase.execute({ id: INVALID_ID })).error
    ).toContain('Invalid agent ID');
  });
});
