import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateAgentUseCase } from 'application/probe-agents/use-cases';
import { PairingKey } from 'application/probe-agents/services';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanAgents, seedAgent } from '../../helpers/db';
import { BACKEND_URL, makeAdapters } from './shared';

describe('CreateAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateAgentUseCase;
  let hash: (secret: string) => string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, secrets, logger } = makeAdapters(prisma);
    hash = (s) => secrets.hash(s);
    useCase = new CreateAgentUseCase(
      repo,
      secrets,
      BACKEND_URL,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-002] persists a PENDING agent holding only the code hash', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    const { pairingCode } = PairingKey.parse(
      result.value.pairingKey
    ).value;
    const row = await prisma.probeAgent.findUnique({
      where: { id: result.value.agent.id }
    });
    expect(row!.status).toBe('PENDING');
    expect(row!.pairingCodeHash).toBe(hash(pairingCode));
    expect(row!.tokenHash).toBeNull();
    expect(JSON.stringify(row)).not.toContain(pairingCode);
  });

  it('[AGT-001] expires the key 24 hours after creation', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    const row = await prisma.probeAgent.findUnique({
      where: { id: result.value.agent.id }
    });
    expect(
      row!.pairingExpiresAt!.getTime() - row!.createdAt.getTime()
    ).toBe(24 * 60 * 60 * 1000);
  });

  it('[AGT-006] rejects a name already taken, even by a revoked agent', async () => {
    await seedAgent(prisma, {
      name: 'Torre Norte',
      status: 'REVOKED'
    });

    const result = await useCase.execute({ name: 'Torre Norte' });

    expect(result.error).toContain('already exists');
    expect(await prisma.probeAgent.count()).toBe(1);
  });
});
