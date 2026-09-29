import { ListAgentsUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('ListAgentsUseCase', () => {
  let repo: InMemoryAgentRepository;
  let useCase: ListAgentsUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    useCase = new ListAgentsUseCase(repo, makeLogger());
  });

  it('lists every agent', async () => {
    const secrets = new FakeAgentSecretService();
    repo.seed(
      makePendingAgent(secrets, 'a', new Date(), 'Torre Norte')
    );
    repo.seed(
      makePendingAgent(secrets, 'b', new Date(), 'POP Centro')
    );

    const result = await useCase.execute();

    expect(result.value.agents.map((a) => a.name)).toEqual([
      'Torre Norte',
      'POP Centro'
    ]);
  });

  it('returns an empty list when there are none', async () => {
    expect((await useCase.execute()).value).toEqual({ agents: [] });
  });

  it('fails when the repository fails', async () => {
    repo.failWith = 'db down';

    expect((await useCase.execute()).error).toBe('db down');
  });
});
