import { AssignDevicesToAgentUseCase } from '../../../../src/application/device-inventory/use-cases/AssignDevicesToAgentUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import {
  Device,
  DeviceName,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import {
  AgentId,
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import {
  FakeAgentAssignmentQuery,
  makeAgentPolicy
} from '../agentFixtures';

const GHOST_ID = '00000000-0000-4000-8000-000000000001';

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeDevice(agentId: AgentId | null = null): Device {
  return Device.create({
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create(`CPE-${Math.random()}`).value,
    status: DeviceStatus.createInventory(),
    ownerType: null,
    locationId: null,
    category: null,
    serialNumber: SerialNumber.create(`SN-${Math.random()}`).value,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    agentId
  }).value;
}

describe('AssignDevicesToAgentUseCase', () => {
  let devices: Map<string, Device>;
  let repo: jest.Mocked<
    Pick<IDeviceRepository, 'findById' | 'findByAgent' | 'save'>
  >;
  let agents: FakeAgentAssignmentQuery;
  let useCase: AssignDevicesToAgentUseCase;

  const add = (device: Device) => {
    devices.set(device.id.toString(), device);
    return device.id.toString();
  };

  beforeEach(() => {
    devices = new Map();
    repo = {
      findById: jest.fn(async (id: DeviceId) =>
        Result.ok(devices.get(id.toString()) ?? null)
      ),
      findByAgent: jest.fn(async (agentId: AgentId | null) =>
        Result.ok(
          [...devices.values()].filter((d) =>
            agentId === null
              ? d.agentId === null
              : d.agentId?.equals(agentId)
          )
        )
      ),
      save: jest.fn(async (d: Device) => Result.ok(d))
    };
    const made = makeAgentPolicy();
    agents = made.agents;
    useCase = new AssignDevicesToAgentUseCase(
      repo as unknown as IDeviceRepository,
      made.policy,
      makeLogger()
    );
  });

  it('[DEV-168] moves the named devices behind the agent', async () => {
    const agentId = agents.add();
    const a = add(makeDevice());
    const b = add(makeDevice());

    const result = await useCase.execute({
      agentId,
      deviceIds: [a, b]
    });

    expect(result.value).toEqual({ assigned: [a, b], failed: [] });
    expect(devices.get(a)!.agentId!.toString()).toBe(agentId);
  });

  it('[DEV-168] moves every in-process device with fromAgentId: null', async () => {
    const agentId = agents.add();
    const inProcess = add(makeDevice());
    const elsewhere = add(
      makeDevice(AgentId.parse(agents.add()).value)
    );

    const result = await useCase.execute({
      agentId,
      fromAgentId: null
    });

    expect(result.value.assigned).toEqual([inProcess]);
    expect(devices.get(elsewhere)!.agentId!.toString()).not.toBe(
      agentId
    );
  });

  it('[DEV-168] follows a replaced PC: from a revoked agent to a new one', async () => {
    const oldAgent = agents.add('REVOKED');
    const newAgent = agents.add();
    const moved = add(makeDevice(AgentId.parse(oldAgent).value));

    const result = await useCase.execute({
      agentId: newAgent,
      fromAgentId: oldAgent
    });

    expect(result.value.assigned).toEqual([moved]);
  });

  it('[DEV-168] sends devices back to in-process with agentId: null', async () => {
    const agentId = agents.add();
    const id = add(makeDevice(AgentId.parse(agentId).value));

    const result = await useCase.execute({
      agentId: null,
      fromAgentId: agentId
    });

    expect(result.value.assigned).toEqual([id]);
    expect(devices.get(id)!.agentId).toBeNull();
  });

  it('[DEV-165] refuses a revoked target and moves nothing', async () => {
    const revoked = agents.add('REVOKED');
    const id = add(makeDevice());

    const result = await useCase.execute({
      agentId: revoked,
      deviceIds: [id]
    });

    expect(result.error).toContain('is revoked');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reports unknown and malformed ids without stopping the rest', async () => {
    const agentId = agents.add();
    const id = add(makeDevice());

    const result = await useCase.execute({
      agentId,
      deviceIds: [GHOST_ID, 'nope', id]
    });

    expect(result.value.assigned).toEqual([id]);
    expect(result.value.failed.map((f) => f.id)).toEqual([
      GHOST_ID,
      'nope'
    ]);
  });

  it('reports a device whose save fails', async () => {
    const agentId = agents.add();
    const id = add(makeDevice());
    repo.save.mockResolvedValueOnce(Result.fail('db down'));

    const result = await useCase.execute({
      agentId,
      deviceIds: [id]
    });

    expect(result.value.failed).toEqual([{ id, error: 'db down' }]);
  });

  it('handles a repeated id once', async () => {
    const agentId = agents.add();
    const id = add(makeDevice());

    const result = await useCase.execute({
      agentId,
      deviceIds: [id, id]
    });

    expect(result.value.assigned).toEqual([id]);
  });

  it.each([
    ['neither selector', {}],
    ['both selectors', { deviceIds: [GHOST_ID], fromAgentId: null }],
    ['an empty list', { deviceIds: [] }]
  ])('rejects %s', async (_label, selector) => {
    const result = await useCase.execute({
      agentId: null,
      ...selector
    });

    expect(result.isFailure).toBe(true);
  });
});
