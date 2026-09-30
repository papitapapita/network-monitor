import { RevokeAgentUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  FakeDeviceCounts,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const GHOST_ID = '00000000-0000-4000-8000-000000000001';

describe('RevokeAgentUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let useCase: RevokeAgentUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    useCase = new RevokeAgentUseCase(
      repo,
      new FakeDeviceCounts(),
      makeLogger()
    );
  });

  it('[AGT-005] revokes an active agent and drops its token', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));
    agent.enroll(secrets.hash('token'));

    const result = await useCase.execute({ id: agent.id.toString() });

    expect(result.value.status).toBe('REVOKED');
    expect(result.value.revokedAt).not.toBeNull();
    expect(agent.tokenHash).toBeNull();
  });

  it('[AGT-005] revokes a pending agent so its key stops working', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));

    await useCase.execute({ id: agent.id.toString() });

    expect(
      (await repo.findByPairingCodeHash(secrets.hash('code'))).value
    ).toBeNull();
  });

  it('[AGT-005] refuses to revoke twice', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));
    await useCase.execute({ id: agent.id.toString() });

    const result = await useCase.execute({ id: agent.id.toString() });

    expect(result.error).toContain('already revoked');
  });

  it('fails for an unknown agent', async () => {
    expect((await useCase.execute({ id: GHOST_ID })).error).toContain(
      'not found'
    );
  });

  it('fails on a malformed id', async () => {
    expect((await useCase.execute({ id: 'nope' })).error).toContain(
      'Invalid agent ID'
    );
  });
});
