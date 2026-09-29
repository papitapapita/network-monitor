import {
  EnrollAgentUseCase,
  INVALID_PAIRING_CODE
} from '../../../../src/application/probe-agents/use-cases';
import { AgentStatus } from '../../../../src/domain/probe-agents';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  FakeAgentSecretService,
  InMemoryAgentRepository,
  makeLogger,
  makePendingAgent
} from '../fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('EnrollAgentUseCase', () => {
  let repo: InMemoryAgentRepository;
  let secrets: FakeAgentSecretService;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: EnrollAgentUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    secrets = new FakeAgentSecretService();
    logger = makeLogger();
    useCase = new EnrollAgentUseCase(repo, secrets, logger);
  });

  it('[AGT-003] exchanges the code for a token and stores only its hash', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'the-code'));

    const result = await useCase.execute({ pairingCode: 'the-code' });

    expect(result.value.token).toBe('secret-1');
    expect(result.value.agentName).toBe('Torre Norte');
    expect(agent.status).toBe(AgentStatus.ACTIVE);
    expect(agent.tokenHash).toBe(secrets.hash('secret-1'));
  });

  it('[AGT-002] works only once', async () => {
    repo.seed(makePendingAgent(secrets, 'the-code'));
    await useCase.execute({ pairingCode: 'the-code' });

    const second = await useCase.execute({ pairingCode: 'the-code' });

    expect(second.error).toBe(INVALID_PAIRING_CODE);
  });

  it('[AGT-001] rejects an expired code', async () => {
    repo.seed(
      makePendingAgent(
        secrets,
        'the-code',
        new Date(Date.now() - DAY_MS - 1)
      )
    );

    const result = await useCase.execute({ pairingCode: 'the-code' });

    expect(result.error).toBe(INVALID_PAIRING_CODE);
  });

  it('[AGT-008] answers an unknown code the same way as an expired one', async () => {
    const result = await useCase.execute({
      pairingCode: 'never-issued'
    });

    expect(result.error).toBe(INVALID_PAIRING_CODE);
    expect(logger.warn).toHaveBeenCalledWith(
      'Agent enrollment rejected',
      expect.objectContaining({ reason: expect.any(String) })
    );
  });

  it('[AGT-002] rejects when a concurrent enrollment consumed the code first', async () => {
    const agent = repo.seed(makePendingAgent(secrets, 'the-code'));
    repo.storedPairingHashes.delete(agent.id.toString());
    const findAgain = jest
      .spyOn(repo, 'findByPairingCodeHash')
      .mockResolvedValue(Result.ok(agent));

    const result = await useCase.execute({ pairingCode: 'the-code' });

    expect(result.error).toBe(INVALID_PAIRING_CODE);
    findAgain.mockRestore();
  });

  it('trims the pasted code', async () => {
    repo.seed(makePendingAgent(secrets, 'the-code'));

    const result = await useCase.execute({
      pairingCode: ' the-code\n'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('never logs the code or the token', async () => {
    repo.seed(makePendingAgent(secrets, 'the-code'));

    await useCase.execute({ pairingCode: 'the-code' });

    const logged = JSON.stringify([
      (logger.info as jest.Mock).mock.calls,
      (logger.warn as jest.Mock).mock.calls
    ]);
    expect(logged).not.toContain('the-code');
    expect(logged).not.toContain('secret-1');
  });

  it('fails on a blank code', async () => {
    expect(
      (await useCase.execute({ pairingCode: ' ' })).error
    ).toContain('required');
  });

  it('surfaces a repository failure as-is, not as a bad code', async () => {
    repo.failWith = 'db down';

    const result = await useCase.execute({ pairingCode: 'the-code' });

    expect(result.error).toBe('db down');
  });
});
