import { RecordAgentContactUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  Agent,
  AgentProps
} from '../../../../src/domain/probe-agents';
import { AgentCameBackEvent } from '../../../../src/domain/probe-agents/events';
import { AgentId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const RECEIVED = new Date('2026-09-28T12:00:00.000Z');

// The same agent as another writer would have saved it: a separate instance,
// as a fresh read from the database would be.
function copyWith(
  agent: Agent,
  overrides: Partial<AgentProps>
): Agent {
  const props = (agent as unknown as { props: AgentProps }).props;
  return Agent.reconstitute(agent.id, { ...props, ...overrides });
}

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

  describe('racing the liveness scan', () => {
    const MARKED = new Date('2026-09-28T11:59:59.000Z');

    function contact(agent: Agent) {
      return useCase.execute({
        agentId: agent.id.toString(),
        agentVersion: '1.0.0',
        sentAt: RECEIVED.getTime(),
        receivedAt: RECEIVED
      });
    }

    it('[AGT-024] re-reads after a miss so the came-back event is not lost', async () => {
      const agent = repo.seed(makeActiveAgent(secrets, 'tok'));
      const markedByScan = copyWith(agent, {
        offlineSince: MARKED,
        updatedAt: MARKED
      });
      const findById = repo.findById.bind(repo);
      let reads = 0;
      jest
        .spyOn(repo, 'findById')
        .mockImplementation(async (id: AgentId) => {
          const found = await findById(id);
          if (++reads === 1) repo.seed(markedByScan);
          return found;
        });

      const result = await contact(agent);

      expect(result.isSuccess).toBe(true);
      expect(reads).toBe(2);
      expect(repo.savedIfUnchanged).toEqual([markedByScan]);
      expect(markedByScan.offlineSince).toBeNull();
      expect(markedByScan.domainEvents).toEqual([
        expect.any(AgentCameBackEvent)
      ]);
    });

    it('[AGT-024] gives up after a second miss', async () => {
      const agent = repo.seed(makeActiveAgent(secrets, 'tok'));
      jest
        .spyOn(repo, 'saveIfUnchanged')
        .mockResolvedValue(Result.ok(false));

      const result = await contact(agent);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'changed while recording contact'
      );
      expect(repo.saveIfUnchanged).toHaveBeenCalledTimes(2);
    });
  });
});
