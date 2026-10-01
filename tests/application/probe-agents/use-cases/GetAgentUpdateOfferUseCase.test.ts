import { GetAgentUpdateOfferUseCase } from '../../../../src/application/probe-agents/use-cases';
import { AgentUpdateOutcome } from '../../../../src/domain/probe-agents';
import { AgentId } from '../../../../src/domain/shared/ids';
import {
  FakeAgentSecretService,
  FakeReleaseCatalog,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger
} from '../fixtures';

describe('GetAgentUpdateOfferUseCase', () => {
  let repo: InMemoryAgentRepository;
  let releases: FakeReleaseCatalog;
  let useCase: GetAgentUpdateOfferUseCase;
  let agentId: string;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
    releases = new FakeReleaseCatalog();
    useCase = new GetAgentUpdateOfferUseCase(
      repo,
      releases,
      makeLogger()
    );
    agentId = repo
      .seed(makeActiveAgent(new FakeAgentSecretService(), 'tok'))
      .id.toString();
  });

  const offer = (
    platform: string | null = 'linux-x64',
    runningVersion = '0.2.0'
  ) => useCase.execute({ agentId, platform, runningVersion });

  it('[AGT-082] offers the newest release’s binary for the agent’s platform', async () => {
    releases.publish('0.2.1');

    const result = await offer();

    expect(result.value).toEqual({
      version: '0.2.1',
      file: 'nms-agent-0.2.1-linux-x64.gz',
      sha256: 'a'.repeat(64),
      bytes: 1000,
      signature: 'c2ln'
    });
  });

  it.each([
    ['there is no release', null, 'linux-x64', '0.2.0'],
    ['the agent names no platform', '0.2.1', null, '0.2.0'],
    ['the platform is unknown', '0.2.1', 'mac-arm64', '0.2.0'],
    ['the release has no binary for it', '0.2.1', 'win-x64', '0.2.0'],
    ['the agent already runs it', '0.2.1', 'linux-x64', '0.2.1'],
    ['the agent runs something newer', '0.2.1', 'linux-x64', '0.3.0']
  ])(
    '[AGT-082] offers nothing when %s',
    async (_label, version, platform, running) => {
      if (version) releases.publish(version);

      const result = await offer(platform, running);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    }
  );

  it('[AGT-082] does not offer again a release that failed on this agent', async () => {
    releases.publish('0.2.1');
    const agent = (await repo.findById(AgentId.parse(agentId).value))
      .value!;
    agent.recordUpdateOutcome(
      '0.2.1',
      AgentUpdateOutcome.ROLLED_BACK,
      'timeout'
    );

    expect((await offer()).value).toBeNull();

    releases.publish('0.2.2');
    expect((await offer()).value?.version).toBe('0.2.2');
  });

  it('fails for an unknown agent', async () => {
    releases.publish('0.2.1');

    const result = await useCase.execute({
      agentId: AgentId.create().toString(),
      platform: 'linux-x64',
      runningVersion: '0.2.0'
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the releases cannot be read', async () => {
    releases.failWith = 'folder gone';

    expect((await offer()).isFailure).toBe(true);
  });
});
