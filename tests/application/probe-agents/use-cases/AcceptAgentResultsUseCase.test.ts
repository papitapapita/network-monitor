import { AcceptAgentResultsUseCase } from '../../../../src/application/probe-agents/use-cases';
import { AgentResultDTO } from '../../../../src/application/probe-agents/dtos';
import {
  FakeDeviceIndex,
  FakeResultSink,
  makeLogger
} from '../fixtures';
import { AgentId } from '../../../../src/domain/shared/ids';

const AGENT_ID = '550e8400-e29b-41d4-a716-446655440010';
const MEASURED = new Date('2026-09-28T12:00:00.000Z');

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
  let useCase: AcceptAgentResultsUseCase;

  beforeEach(async () => {
    index = new FakeDeviceIndex();
    await index.indexesFor(AgentId.parse(AGENT_ID).value, [
      'dev-a',
      'dev-b'
    ]);
    index.assignedToAgent.add('dev-a');
    index.assignedToAgent.add('dev-b');
    sink = new FakeResultSink();
    useCase = new AcceptAgentResultsUseCase(
      index,
      sink,
      makeLogger()
    );
  });

  it('[AGT-043] hands each result to its device and acknowledges it', async () => {
    const result = await useCase.execute({
      agentId: AGENT_ID,
      results: [measured('r1', 0), measured('r2', 1)]
    });

    expect(result.value.acknowledged).toEqual(['r1', 'r2']);
    expect(sink.accepted.map((r) => r.deviceId)).toEqual([
      'dev-a',
      'dev-b'
    ]);
    expect(sink.accepted[0].measuredAt).toEqual(MEASURED);
  });

  it('[AGT-043] drops and acknowledges a result for a device moved away', async () => {
    index.assignedToAgent.delete('dev-b');

    const result = await useCase.execute({
      agentId: AGENT_ID,
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
      results: [measured('r1', 0), measured('r2', 1)]
    });

    expect(result.value.acknowledged).toEqual(['r1']);
  });

  it('passes a probe that could not run through as such', async () => {
    await useCase.execute({
      agentId: AGENT_ID,
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
