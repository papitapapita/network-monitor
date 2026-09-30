import { ReissuePairingKeyUseCase } from '../../../../src/application/probe-agents/use-cases';
import { parsePairingKey } from '../../../../src/agent/protocol';
import {
  BACKEND_URL,
  FakeAgentSecretService,
  FakeDeviceCounts,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const GHOST_ID = '00000000-0000-4000-8000-000000000001';

describe('ReissuePairingKeyUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let useCase: ReissuePairingKeyUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    useCase = new ReissuePairingKeyUseCase(
      repo,
      new FakeDeviceCounts(),
      secrets,
      BACKEND_URL,
      makeLogger()
    );
  });

  it('[AGT-004] issues a new key and the old code stops matching', async () => {
    const agent = repo.seed(
      makePendingAgent(secrets, 'old-code', new Date(0))
    );

    const result = await useCase.execute({ id: agent.id.toString() });

    const { pairingCode } = parsePairingKey(result.value.pairingKey)!;
    expect(pairingCode).not.toBe('old-code');
    expect(
      (await repo.findByPairingCodeHash(secrets.hash('old-code')))
        .value
    ).toBeNull();
    expect(
      (await repo.findByPairingCodeHash(secrets.hash(pairingCode)))
        .value
    ).not.toBeNull();
  });

  it('[AGT-004] refuses an agent that already enrolled', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));
    agent.enroll(secrets.hash('token'));

    const result = await useCase.execute({ id: agent.id.toString() });

    expect(result.error).toContain('Only a pending agent');
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

  it('[AGT-007] fails without AGENT_PUBLIC_URL', async () => {
    useCase = new ReissuePairingKeyUseCase(
      repo,
      new FakeDeviceCounts(),
      secrets,
      null,
      makeLogger()
    );

    expect((await useCase.execute({ id: GHOST_ID })).error).toContain(
      'AGENT_PUBLIC_URL'
    );
  });
});
