import { RecordAgentContactUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const RECEIVED = new Date('2026-09-28T12:00:00.000Z');

describe('RecordAgentContactUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let useCase: RecordAgentContactUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    useCase = new RecordAgentContactUseCase(repo, makeLogger());
  });

  it('[AGT-020] stores last seen, version and clock offset', async () => {
    const agent = repo.seed(makeActiveAgent(secrets, 'tok'));

    const result = await useCase.execute({
      agentId: agent.id.toString(),
      agentVersion: '1.0.3',
      sentAt: RECEIVED.getTime() + 90_000,
      receivedAt: RECEIVED
    });

    expect(result.isSuccess).toBe(true);
    expect(agent.lastSeenAt).toEqual(RECEIVED);
    expect(agent.agentVersion).toBe('1.0.3');
    expect(agent.clockOffsetMs).toBe(90_000);
  });

  it('refuses an agent that has not enrolled', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'code'));

    const result = await useCase.execute({
      agentId: agent.id.toString(),
      agentVersion: '1.0.0',
      sentAt: RECEIVED.getTime(),
      receivedAt: RECEIVED
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails for an unknown agent', async () => {
    const result = await useCase.execute({
      agentId: '00000000-0000-4000-8000-000000000001',
      agentVersion: '1.0.0',
      sentAt: 0,
      receivedAt: RECEIVED
    });

    expect(result.error).toContain('not found');
  });
});
