// Source: src/application/service-enforcement/use-cases/ReleaseSuspensionUseCase.ts

import { ReleaseSuspensionUseCase } from '../../../../src/application/service-enforcement/use-cases/ReleaseSuspensionUseCase';
import { EnforcementRouterResolver } from '../../../../src/application/service-enforcement/services/EnforcementRouterResolver';
import {
  IRouterQueueService,
  RouterConnection
} from '../../../../src/application/service-enforcement/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440090';

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

function makeSetup() {
  const routerResolver = {
    resolve: jest.fn()
  } as unknown as jest.Mocked<EnforcementRouterResolver>;
  const routerQueueService: jest.Mocked<IRouterQueueService> = {
    listSuspensionQueues: jest.fn(),
    addSuspensionQueue: jest.fn(),
    removeSuspensionQueue: jest.fn()
  };
  const useCase = new ReleaseSuspensionUseCase(
    routerResolver,
    routerQueueService,
    makeLogger()
  );
  return { useCase, routerResolver, routerQueueService };
}

describe('ReleaseSuspensionUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path', () => {
    it('should remove the suspension queue for the contracted service', async () => {
      const setup = makeSetup();
      setup.routerResolver.resolve.mockResolvedValue(
        Result.ok(ROUTER_CONNECTION)
      );
      setup.routerQueueService.removeSuspensionQueue.mockResolvedValue(
        Result.ok()
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        contractedServiceId: CS_UUID,
        queueName: `suspend-${CS_UUID}`
      });
      expect(
        setup.routerQueueService.removeSuspensionQueue
      ).toHaveBeenCalledWith(ROUTER_CONNECTION, `suspend-${CS_UUID}`);
    });

    it('should succeed when the queue is already gone (idempotent adapter)', async () => {
      const setup = makeSetup();
      setup.routerResolver.resolve.mockResolvedValue(
        Result.ok(ROUTER_CONNECTION)
      );
      // the adapter treats a missing queue as success
      setup.routerQueueService.removeSuspensionQueue.mockResolvedValue(
        Result.ok()
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Failures', () => {
    it('should fail when contractedServiceId is missing', async () => {
      const setup = makeSetup();

      const result = await setup.useCase.execute({
        contractedServiceId: ''
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'contractedServiceId is required'
      );
    });

    it('should fail when contractedServiceId is not a valid UUID', async () => {
      const setup = makeSetup();

      const result = await setup.useCase.execute({
        contractedServiceId: 'nope'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid contracted service ID');
    });

    it('should fail when the router connection cannot be resolved', async () => {
      const setup = makeSetup();
      setup.routerResolver.resolve.mockResolvedValue(
        Result.fail('Enforcement router credentials not configured')
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('credentials not configured');
    });

    it('should fail when the router is unreachable', async () => {
      const setup = makeSetup();
      setup.routerResolver.resolve.mockResolvedValue(
        Result.ok(ROUTER_CONNECTION)
      );
      setup.routerQueueService.removeSuspensionQueue.mockResolvedValue(
        Result.fail('RouterOS API error: connection timed out')
      );

      const result = await setup.useCase.execute({
        contractedServiceId: CS_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to remove suspension queue'
      );
    });
  });
});
