import {
  AuthenticateAgentUseCase,
  INVALID_AGENT_TOKEN
} from '../../../../src/application/probe-agents/use-cases';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger,
  makePendingAgent
} from '../fixtures';

describe('AuthenticateAgentUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: AuthenticateAgentUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    logger = makeLogger();
    useCase = new AuthenticateAgentUseCase(repo, secrets, logger);
  });

  it('[AGT-040] identifies the agent from its token alone', async () => {
    const agent = repo.seed(makeActiveAgent(secrets, 'tok-1'));

    const result = await useCase.execute({ token: 'tok-1' });

    expect(result.value).toEqual({
      agentId: agent.id.toString(),
      agentName: 'Torre Norte'
    });
  });

  it.each([
    ['an unknown token', 'nope'],
    ['a blank token', '  ']
  ])('[AGT-040] rejects %s', async (_label, token) => {
    repo.seed(makeActiveAgent(secrets, 'tok-1'));

    expect((await useCase.execute({ token })).error).toBe(
      INVALID_AGENT_TOKEN
    );
  });

  it('[AGT-005] rejects the token of a revoked agent', async () => {
    const agent = repo.seed(makeActiveAgent(secrets, 'tok-1'));
    agent.revoke();

    expect((await useCase.execute({ token: 'tok-1' })).error).toBe(
      INVALID_AGENT_TOKEN
    );
  });

  it('does not treat a pairing code as a token', async () => {
    repo.seed(makePendingAgent(secrets, 'pair-code'));

    expect(
      (await useCase.execute({ token: 'pair-code' })).isFailure
    ).toBe(true);
  });

  it('never logs the token', async () => {
    repo.seed(makeActiveAgent(secrets, 'tok-secret'));

    await useCase.execute({ token: 'tok-secret' });

    expect(
      JSON.stringify((logger.info as jest.Mock).mock.calls)
    ).not.toContain('tok-secret');
  });
});
