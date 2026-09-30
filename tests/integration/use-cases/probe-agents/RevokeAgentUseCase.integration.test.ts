import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  EnrollAgentUseCase,
  INVALID_PAIRING_CODE,
  RevokeAgentUseCase
} from 'application/probe-agents/use-cases';
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
import { makeAdapters } from './shared';

describe('RevokeAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RevokeAgentUseCase;
  let enroll: EnrollAgentUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, deviceCounts, secrets, logger } =
      makeAdapters(prisma);
    useCase = new RevokeAgentUseCase(repo, deviceCounts, logger);
    enroll = new EnrollAgentUseCase(repo, secrets, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-005] clears the token of an active agent', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    const result = await useCase.execute({ id });

    expect(result.value.status).toBe('REVOKED');
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.tokenHash).toBeNull();
    expect(row!.revokedAt).not.toBeNull();
  });

  it('[AGT-005] kills the pairing key of a pending agent', async () => {
    const { id, pairingCode } = await seedAgent(prisma);

    await useCase.execute({ id });

    expect((await enroll.execute({ pairingCode })).error).toBe(
      INVALID_PAIRING_CODE
    );
  });

  it('[AGT-005] keeps the row — revocation is not deletion', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    await useCase.execute({ id });

    expect(await prisma.probeAgent.count({ where: { id } })).toBe(1);
  });

  it('refuses to revoke twice', async () => {
    const { id } = await seedAgent(prisma, { status: 'REVOKED' });

    expect((await useCase.execute({ id })).error).toContain(
      'already revoked'
    );
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
