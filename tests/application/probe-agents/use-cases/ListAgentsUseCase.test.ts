import { ListAgentsUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  FakeDeviceCounts,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('ListAgentsUseCase', () => {
  let repo: InMemoryAgentRepository;
  let counts: FakeDeviceCounts;
  let useCase: ListAgentsUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    counts = new FakeDeviceCounts();
    useCase = new ListAgentsUseCase(repo, counts, makeLogger());
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

  it('[AGT-010] reports how many devices each agent has, zero when none', async () => {
    const secrets = new FakeAgentSecretService();
    const busy = repo.seed(
      makePendingAgent(secrets, 'a', new Date(), 'Torre Norte')
    );
    repo.seed(
      makePendingAgent(secrets, 'b', new Date(), 'POP Centro')
    );
    counts.counts.set(busy.id.toString(), 12);

    const result = await useCase.execute();

    expect(
      result.value.agents.map((a) => [a.name, a.deviceCount])
    ).toEqual([
      ['Torre Norte', 12],
      ['POP Centro', 0]
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
