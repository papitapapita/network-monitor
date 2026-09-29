import { BuildAgentConfigSnapshotUseCase } from '../../../../src/application/probe-agents/use-cases';
import {
  FakeDeviceIndex,
  FakeTargetsQuery,
  makeLogger
} from '../fixtures';

const AGENT_ID = '550e8400-e29b-41d4-a716-446655440010';
const target = (deviceId: string, ip: string) => ({
  deviceId,
  ipAddress: ip,
  intervalSeconds: 60,
  failuresBeforeDown: 3
});

describe('BuildAgentConfigSnapshotUseCase', () => {
  let targets: FakeTargetsQuery;
  let index: FakeDeviceIndex;
  let useCase: BuildAgentConfigSnapshotUseCase;

  beforeEach(() => {
    targets = new FakeTargetsQuery();
    index = new FakeDeviceIndex();
    useCase = new BuildAgentConfigSnapshotUseCase(
      targets,
      index,
      makeLogger()
    );
  });

  const build = async () =>
    (await useCase.execute({ agentId: AGENT_ID })).value;

  it('[AGT-041] lists each device by index with how to poll it', async () => {
    targets.targets = [target('dev-a', '10.0.0.1')];

    const snapshot = await build();

    expect(snapshot.devices).toEqual([
      {
        index: 0,
        ipAddress: '10.0.0.1',
        intervalSeconds: 60,
        failuresBeforeDown: 3
      }
    ]);
    expect(JSON.stringify(snapshot)).not.toContain('dev-a');
  });

  it('[AGT-041] keeps a device on its index when others come and go', async () => {
    targets.targets = [
      target('dev-a', '10.0.0.1'),
      target('dev-b', '10.0.0.2')
    ];
    await build();
    targets.targets = [
      target('dev-b', '10.0.0.2'),
      target('dev-c', '10.0.0.3')
    ];

    const snapshot = await build();

    expect(
      snapshot.devices.map((d) => [d.ipAddress, d.index])
    ).toEqual([
      ['10.0.0.2', 1],
      ['10.0.0.3', 2]
    ]);
  });

  it('[AGT-042] keeps the version while nothing changes', async () => {
    targets.targets = [target('dev-a', '10.0.0.1')];

    expect((await build()).version).toBe((await build()).version);
  });

  it('[AGT-042] changes the version when a setting changes', async () => {
    targets.targets = [target('dev-a', '10.0.0.1')];
    const before = (await build()).version;
    targets.targets = [
      { ...target('dev-a', '10.0.0.1'), intervalSeconds: 30 }
    ];

    expect((await build()).version).not.toBe(before);
  });

  it('builds an empty snapshot for an agent with no devices', async () => {
    const snapshot = await build();

    expect(snapshot.devices).toEqual([]);
    expect(snapshot.version).toMatch(/^[0-9a-f]{16}$/);
  });
});
