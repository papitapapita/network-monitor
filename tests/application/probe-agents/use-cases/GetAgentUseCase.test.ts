import { GetAgentUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('GetAgentUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let useCase: GetAgentUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    useCase = new GetAgentUseCase(repo, makeLogger());
  });

  it('returns the agent without any secret material', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));

    const result = await useCase.execute({ id: agent.id.toString() });

    expect(result.value.name).toBe('Torre Norte');
    expect(result.value).not.toHaveProperty('pairingCodeHash');
    expect(result.value).not.toHaveProperty('tokenHash');
  });

  it('fails for an unknown agent', async () => {
    const result = await useCase.execute({
      id: '00000000-0000-4000-8000-000000000001'
    });

    expect(result.error).toContain('not found');
  });

  it('fails on a malformed id', async () => {
    expect((await useCase.execute({ id: 'nope' })).error).toContain(
      'Invalid agent ID'
    );
  });
});
