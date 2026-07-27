// Source: src/application/service-enforcement/use-cases/ListSuspensionEnforcementsUseCase.ts
// Source: src/application/service-enforcement/use-cases/GetServiceEnforcementStatusUseCase.ts

import { ListSuspensionEnforcementsUseCase } from '../../../../src/application/service-enforcement/use-cases/ListSuspensionEnforcementsUseCase';
import { GetServiceEnforcementStatusUseCase } from '../../../../src/application/service-enforcement/use-cases/GetServiceEnforcementStatusUseCase';
import { EnforcementRouterResolver } from '../../../../src/application/service-enforcement/services/EnforcementRouterResolver';
import {
  IRouterQueueService,
  RouterConnection
} from '../../../../src/application/service-enforcement/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-4466554400c1';
const OTHER_CS_UUID = '550e8400-e29b-41d4-a716-4466554400c2';

const ROUTER_CONNECTION: RouterConnection = {
  host: '10.0.0.1',
  port: 8728,
  username: 'api',
  password: 'secret'
};

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeMocks() {
  const routerResolver = {
    resolve: jest.fn().mockResolvedValue(Result.ok(ROUTER_CONNECTION))
  } as unknown as jest.Mocked<EnforcementRouterResolver>;
  const routerQueueService: jest.Mocked<IRouterQueueService> = {
    listSuspensionQueues: jest.fn(),
    addSuspensionQueue: jest.fn(),
    removeSuspensionQueue: jest.fn()
  };
  return { routerResolver, routerQueueService };
}

describe('ListSuspensionEnforcementsUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should map suspend-* queues to contracted service ids', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.ok([
        { name: `suspend-${CS_UUID}`, targetIp: '10.20.30.40' },
        { name: `suspend-${OTHER_CS_UUID}`, targetIp: '10.20.30.41' }
      ])
    );
    const useCase = new ListSuspensionEnforcementsUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.checkedAt).toEqual(expect.any(String));
    expect(result.value.enforcements).toEqual([
      { contractedServiceId: CS_UUID, targetIp: '10.20.30.40' },
      { contractedServiceId: OTHER_CS_UUID, targetIp: '10.20.30.41' }
    ]);
  });

  it('should return an empty list when no suspensions are enforced', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.ok([])
    );
    const useCase = new ListSuspensionEnforcementsUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.enforcements).toEqual([]);
  });

  it('should fail when the router connection cannot be resolved', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerResolver.resolve.mockResolvedValue(
      Result.fail('Enforcement router device not found')
    );
    const useCase = new ListSuspensionEnforcementsUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Enforcement router');
  });

  it('should fail when the router is unreachable', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.fail('RouterOS API error: connection timed out')
    );
    const useCase = new ListSuspensionEnforcementsUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('RouterOS API error');
  });
});

describe('GetServiceEnforcementStatusUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should report enforced with the target IP when the queue exists', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.ok([
        { name: `suspend-${CS_UUID}`, targetIp: '10.20.30.40' }
      ])
    );
    const useCase = new GetServiceEnforcementStatusUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({
      contractedServiceId: CS_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      contractedServiceId: CS_UUID,
      enforced: true,
      targetIp: '10.20.30.40',
      checkedAt: expect.any(String)
    });
  });

  it('should report not enforced when no queue exists for the service', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.ok([
        { name: `suspend-${OTHER_CS_UUID}`, targetIp: '10.20.30.41' }
      ])
    );
    const useCase = new GetServiceEnforcementStatusUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({
      contractedServiceId: CS_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.enforced).toBe(false);
    expect(result.value.targetIp).toBeNull();
  });

  it('should fail when contractedServiceId is missing', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    const useCase = new GetServiceEnforcementStatusUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({ contractedServiceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('contractedServiceId is required');
  });

  it('should fail when contractedServiceId is not a valid UUID', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    const useCase = new GetServiceEnforcementStatusUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({
      contractedServiceId: 'nope'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid contracted service ID');
  });

  it('should fail when the router is unreachable', async () => {
    const { routerResolver, routerQueueService } = makeMocks();
    routerQueueService.listSuspensionQueues.mockResolvedValue(
      Result.fail('RouterOS API error: connection timed out')
    );
    const useCase = new GetServiceEnforcementStatusUseCase(
      routerResolver,
      routerQueueService,
      makeLogger()
    );

    const result = await useCase.execute({
      contractedServiceId: CS_UUID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('RouterOS API error');
  });
});
