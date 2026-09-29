import { AcceptAgentResultsUseCase } from '../../../../src/application/probe-agents/use-cases';
import { AgentResultDTO } from '../../../../src/application/probe-agents/dtos';
import {
  FakeAgentSecretService,
  FakeDeviceIndex,
  FakeResultSink,
  InMemoryAgentRepository,
  makeActiveAgent,
  makeLogger
} from '../fixtures';
import { Agent } from '../../../../src/domain/probe-agents';

const MEASURED = new Date('2026-09-28T12:00:00.000Z');
const RECEIVED = new Date('2026-09-28T12:00:02.000Z');

const measured = (
  id: string,
  deviceIndex: number
): AgentResultDTO => ({
  id,
  deviceIndex,
  measuredAt: MEASURED,
  outcome: {
    kind: 'measured',
    isReachable: true,
    latencyMs: 5,
    attempts: 1
  }
});

describe('AcceptAgentResultsUseCase', () => {
  let index: FakeDeviceIndex;
  let sink: FakeResultSink;
  let agents: InMemoryAgentRepository;
  let agent: Agent;
  let AGENT_ID: string;
  let useCase: AcceptAgentResultsUseCase;

  beforeEach(async () => {
    agents = new InMemoryAgentRepository();
    agent = agents.seed(
      makeActiveAgent(new FakeAgentSecretService(), 'tok')
    );
    AGENT_ID = agent.id.toString();
    index = new FakeDeviceIndex();
    await index.indexesFor(agent.id, ['dev-a', 'dev-b']);
    index.assignedToAgent.add('dev-a');
    index.assignedToAgent.add('dev-b');
    sink = new FakeResultSink();
    useCase = new AcceptAgentResultsUseCase(
      agents,
      index,
      sink,
      makeLogger()
    );
  });

  it('[AGT-043] hands each result to its device and acknowledges it', async () => {
    const result = await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [measured('r1', 0), measured('r2', 1)]
    });

    expect(result.value.acknowledged).toEqual(['r1', 'r2']);
    expect(sink.accepted.map((r) => r.deviceId)).toEqual([
      'dev-a',
      'dev-b'
    ]);
    expect(sink.accepted[0]).toMatchObject({
      resultId: 'r1',
      measuredAt: MEASURED,
      receivedAt: RECEIVED
    });
  });

  it('[AGT-046] moves each timestamp onto the backend clock by the agent offset', async () => {
    // The agent's clock runs 90 s ahead of ours.
    agent.recordContact('1.0.0', 90_000, RECEIVED);

    await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [measured('r1', 0)]
    });

    expect(sink.accepted[0].measuredAt).toEqual(
      new Date(MEASURED.getTime() - 90_000)
    );
  });

  it('[AGT-046] never dates a result after the batch arrived', async () => {
    // A clock behind ours: correcting pushes the time forward.
    agent.recordContact('1.0.0', -60_000, RECEIVED);

    await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [measured('r1', 0)]
    });

    expect(sink.accepted[0].measuredAt).toEqual(RECEIVED);
  });

  it('fails for an unknown agent', async () => {
    const result = await useCase.execute({
      agentId: '550e8400-e29b-41d4-a716-446655440010',
      receivedAt: RECEIVED,
      results: [measured('r1', 0)]
    });

    expect(result.error).toContain('not found');
    expect(sink.accepted).toEqual([]);
  });

  it('[AGT-043] drops and acknowledges a result for a device moved away', async () => {
    index.assignedToAgent.delete('dev-b');

    const result = await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [
        measured('r1', 0),
        measured('r2', 1),
        measured('r3', 99)
      ]
    });

    expect(result.value.acknowledged).toEqual(['r1', 'r2', 'r3']);
    expect(sink.accepted.map((r) => r.deviceId)).toEqual(['dev-a']);
  });

  it('[AGT-043] leaves a result it could not store unacknowledged', async () => {
    sink.failFor.add('dev-b');

    const result = await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [measured('r1', 0), measured('r2', 1)]
    });

    expect(result.value.acknowledged).toEqual(['r1']);
  });

  it('passes a probe that could not run through as such', async () => {
    await useCase.execute({
      agentId: AGENT_ID,
      receivedAt: RECEIVED,
      results: [
        {
          id: 'r1',
          deviceIndex: 0,
          measuredAt: MEASURED,
          outcome: {
            kind: 'probe-unavailable',
            error: 'EPERM',
            attempts: 3
          }
        }
      ]
    });

    expect(sink.accepted[0].outcome).toEqual({
      kind: 'probe-unavailable',
      error: 'EPERM',
      attempts: 3
    });
  });
});
