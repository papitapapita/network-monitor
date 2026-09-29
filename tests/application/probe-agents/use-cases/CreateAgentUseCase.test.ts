import {
  CreateAgentUseCase,
  AGENT_PUBLIC_URL_MISSING
} from '../../../../src/application/probe-agents/use-cases';
import { parsePairingKey } from '../../../../src/agent/protocol';
import {
  BACKEND_URL,
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('CreateAgentUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: CreateAgentUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    logger = makeLogger();
    useCase = new CreateAgentUseCase(
      repo,
      secrets,
      BACKEND_URL,
      logger
    );
  });

  it('[AGT-001] returns a pairing key pointing at this backend', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    const parts = parsePairingKey(result.value.pairingKey)!;
    expect(parts.backendUrl).toBe(BACKEND_URL);
    expect(parts.pairingCode).toBe('secret-1');
  });

  it('[AGT-002] stores only the hash of the pairing code', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    const stored = [...repo.agents.values()][0];
    expect(stored.pairingCodeHash).toBe(secrets.hash('secret-1'));
    expect(JSON.stringify(result.value.agent)).not.toContain(
      'secret-1'
    );
  });

  it('creates the agent PENDING', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    expect(result.value.agent.status).toBe('PENDING');
    expect(result.value.agent.pairingExpiresAt).not.toBeNull();
  });

  it('never logs the pairing key', async () => {
    const result = await useCase.execute({ name: 'Torre Norte' });

    const logged = JSON.stringify(
      (logger.info as jest.Mock).mock.calls
    );
    expect(logged).not.toContain(result.value.pairingKey);
  });

  it('[AGT-007] fails without AGENT_PUBLIC_URL and creates nothing', async () => {
    useCase = new CreateAgentUseCase(repo, secrets, null, logger);

    const result = await useCase.execute({ name: 'Torre Norte' });

    expect(result.error).toBe(AGENT_PUBLIC_URL_MISSING);
    expect(repo.agents.size).toBe(0);
  });

  it('[AGT-006] refuses a duplicate name', async () => {
    repo.seed(makePendingAgent(secrets, 'other'));

    const result = await useCase.execute({ name: 'Torre Norte' });

    expect(result.error).toContain('already exists');
  });

  it('fails on a blank name', async () => {
    const result = await useCase.execute({ name: '  ' });

    expect(result.error).toContain('required');
  });

  it('fails when the agent cannot be saved', async () => {
    repo.failWith = 'db down';

    expect((await useCase.execute({ name: 'X' })).error).toBe(
      'db down'
    );
  });
});
