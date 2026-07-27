// Source: src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.ts

import { ContractedServiceStatusChangedEnforcementHandler } from '../../../../src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler';
import { EnforceSuspensionUseCase } from '../../../../src/application/service-enforcement/use-cases/EnforceSuspensionUseCase';
import { ReleaseSuspensionUseCase } from '../../../../src/application/service-enforcement/use-cases/ReleaseSuspensionUseCase';
import { ContractedServiceStatusChangedEvent } from '../../../../src/domain/customers/events/ContractedServiceStatusChangedEvent';
import { ContractedServiceStatus } from '../../../../src/domain/customers/enums/ContractedServiceStatus';
import { ContractedServiceId } from '../../../../src/domain/shared/ids/ContractedServiceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440091';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeEvent(
  previousStatus: ContractedServiceStatus,
  newStatus: ContractedServiceStatus
): ContractedServiceStatusChangedEvent {
  return new ContractedServiceStatusChangedEvent({
    aggregateId: ContractedServiceId.parse(CS_UUID).value,
    previousStatus,
    newStatus,
    dateTimeOccurred: FIXED_DATE
  });
}

describe('ContractedServiceStatusChangedEnforcementHandler', () => {
  let enforceUseCase: jest.Mocked<
    Pick<EnforceSuspensionUseCase, 'execute'>
  >;
  let releaseUseCase: jest.Mocked<
    Pick<ReleaseSuspensionUseCase, 'execute'>
  >;
  let logger: jest.Mocked<ILogger>;
  let handler: ContractedServiceStatusChangedEnforcementHandler;

  beforeEach(() => {
    enforceUseCase = { execute: jest.fn() };
    releaseUseCase = { execute: jest.fn() };
    logger = makeLogger();
    handler = new ContractedServiceStatusChangedEnforcementHandler(
      enforceUseCase as unknown as EnforceSuspensionUseCase,
      releaseUseCase as unknown as ReleaseSuspensionUseCase,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transition matrix', () => {
    it('ACTIVE → SUSPENDED enforces', async () => {
      enforceUseCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          queueName: `suspend-${CS_UUID}`,
          targetIp: '10.0.0.2'
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.ACTIVE,
          ContractedServiceStatus.SUSPENDED
        )
      );

      expect(enforceUseCase.execute).toHaveBeenCalledWith({
        contractedServiceId: CS_UUID
      });
      expect(releaseUseCase.execute).not.toHaveBeenCalled();
    });

    it('PENDING → SUSPENDED enforces', async () => {
      enforceUseCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          queueName: `suspend-${CS_UUID}`,
          targetIp: '10.0.0.2'
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.PENDING,
          ContractedServiceStatus.SUSPENDED
        )
      );

      expect(enforceUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('SUSPENDED → ACTIVE releases', async () => {
      releaseUseCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          queueName: `suspend-${CS_UUID}`
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.SUSPENDED,
          ContractedServiceStatus.ACTIVE
        )
      );

      expect(releaseUseCase.execute).toHaveBeenCalledWith({
        contractedServiceId: CS_UUID
      });
      expect(enforceUseCase.execute).not.toHaveBeenCalled();
    });

    it('SUSPENDED → CANCELLED releases', async () => {
      releaseUseCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          queueName: `suspend-${CS_UUID}`
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.SUSPENDED,
          ContractedServiceStatus.CANCELLED
        )
      );

      expect(releaseUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('PENDING → ACTIVE is a no-op', async () => {
      await handler.handle(
        makeEvent(
          ContractedServiceStatus.PENDING,
          ContractedServiceStatus.ACTIVE
        )
      );

      expect(enforceUseCase.execute).not.toHaveBeenCalled();
      expect(releaseUseCase.execute).not.toHaveBeenCalled();
    });

    it('ACTIVE → CANCELLED is a no-op', async () => {
      await handler.handle(
        makeEvent(
          ContractedServiceStatus.ACTIVE,
          ContractedServiceStatus.CANCELLED
        )
      );

      expect(enforceUseCase.execute).not.toHaveBeenCalled();
      expect(releaseUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('failure isolation', () => {
    it('should only log when enforce fails', async () => {
      enforceUseCase.execute.mockResolvedValue(
        Result.fail('router unreachable')
      );

      await expect(
        handler.handle(
          makeEvent(
            ContractedServiceStatus.ACTIVE,
            ContractedServiceStatus.SUSPENDED
          )
        )
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'ContractedServiceStatusChangedEnforcementHandler: enforce failed',
        undefined,
        { contractedServiceId: CS_UUID, error: 'router unreachable' }
      );
    });

    it('should only log when release throws', async () => {
      releaseUseCase.execute.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(
          makeEvent(
            ContractedServiceStatus.SUSPENDED,
            ContractedServiceStatus.ACTIVE
          )
        )
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'ContractedServiceStatusChangedEnforcementHandler: unexpected error',
        expect.any(Error),
        { contractedServiceId: CS_UUID }
      );
    });
  });
});
