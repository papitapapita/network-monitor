import { MarkSilentAgentsOfflineUseCase } from '../../../../src/application/probe-agents/use-cases';
import { Agent } from '../../../../src/domain/probe-agents';
import { Result } from '../../../../src/domain/shared/core/Result';
import { AgentWentOfflineEvent } from '../../../../src/domain/probe-agents/events';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const LONG_AGO = new Date(
  Date.now() - Agent.OFFLINE_AFTER_MS - 60_000
);

describe('MarkSilentAgentsOfflineUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: MarkSilentAgentsOfflineUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    logger = makeLogger();
    useCase = new MarkSilentAgentsOfflineUseCase(repo, logger);
  });

  function silentAgent(token: string, name: string): Agent {
    const agent = makeActiveAgent(secrets, token, name);
    agent.recordContact('1.0.0', 0, LONG_AGO);
    agent.clearEvents();
    return repo.seed(agent);
  }

  it('[AGT-021] marks an agent silent past the threshold offline', async () => {
    const agent = silentAgent('tok', 'Torre Norte');

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([agent.id.toString()]);
    expect(agent.isOffline).toBe(true);
    expect(agent.domainEvents).toEqual([
      expect.any(AgentWentOfflineEvent)
    ]);
  });

  it('[AGT-021] leaves recent, pending and already-offline agents alone', async () => {
    const recent = repo.seed(
      makeActiveAgent(secrets, 'fresh', 'Fresco')
    );
    recent.recordContact('1.0.0', 0, new Date());
    repo.seed(
      makePendingAgent(secrets, 'code', new Date(0), 'Nuevo')
    );
    silentAgent('old', 'Viejo');
    await useCase.execute();

    const second = await useCase.execute();

    expect(second.value.markedOffline).toEqual([]);
    expect(recent.isOffline).toBe(false);
  });

  it('[AGT-024] skips an agent that reported in after it was read', async () => {
    const agent = silentAgent('tok', 'Torre Norte');
    repo.storedUpdatedAt.set(agent.id.toString(), new Date());

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([]);
    expect(repo.savedIfUnchanged).toEqual([]);
  });

  it('keeps scanning when one save fails', async () => {
    silentAgent('a', 'Uno');
    const second = silentAgent('b', 'Dos');
    const save = repo.saveIfUnchanged.bind(repo);
    let calls = 0;
    jest
      .spyOn(repo, 'saveIfUnchanged')
      .mockImplementation(async (agent, loaded) =>
        ++calls === 1
          ? Result.fail<boolean>('db down')
          : save(agent, loaded)
      );

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([
      second.id.toString()
    ]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when the agents cannot be read', async () => {
    repo.failWith = 'db down';

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
  });
});
