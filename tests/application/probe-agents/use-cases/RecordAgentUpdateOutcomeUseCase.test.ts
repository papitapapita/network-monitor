import { RecordAgentUpdateOutcomeUseCase } from '../../../../src/application/probe-agents/use-cases';
import { AgentUpdateOutcome } from '../../../../src/domain/probe-agents';
import { AgentUpdateFailedEvent } from '../../../../src/domain/probe-agents/events';
import { AgentId } from '../../../../src/domain/shared/ids';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('RecordAgentUpdateOutcomeUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let useCase: RecordAgentUpdateOutcomeUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    useCase = new RecordAgentUpdateOutcomeUseCase(repo, makeLogger());
  });

  it('[AGT-084] stores what the agent reports', async () => {
    const agent = repo.seed(makeActiveAgent(secrets, 'tok'));

    const result = await useCase.execute({
      agentId: agent.id.toString(),
      version: '0.2.1',
      outcome: 'REJECTED',
      reason: 'Signature does not verify'
    });

    expect(result.isSuccess).toBe(true);
    const stored = (await repo.findById(agent.id)).value!;
    expect(stored.lastUpdate).toMatchObject({
      version: '0.2.1',
      outcome: AgentUpdateOutcome.REJECTED,
      reason: 'Signature does not verify'
    });
    expect(
      stored.domainEvents.some(
        (e) => e instanceof AgentUpdateFailedEvent
      )
    ).toBe(true);
  });

  it('refuses a report the agent could not have made', async () => {
    const agent = repo.seed(makeActiveAgent(secrets, 'tok'));

    const result = await useCase.execute({
      agentId: agent.id.toString(),
      version: 'latest',
      outcome: 'INSTALLED',
      reason: null
    });

    expect(result.isFailure).toBe(true);
  });

  it('refuses an agent that has not enrolled', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));

    const result = await useCase.execute({
      agentId: agent.id.toString(),
      version: '0.2.1',
      outcome: 'INSTALLED',
      reason: null
    });

    expect(result.isFailure).toBe(true);
  });

  it.each([
    ['an unknown agent', AgentId.create().toString()],
    ['a malformed id', 'nope']
  ])('fails for %s', async (_label, agentId) => {
    const result = await useCase.execute({
      agentId,
      version: '0.2.1',
      outcome: 'INSTALLED',
      reason: null
    });

    expect(result.isFailure).toBe(true);
  });
});
