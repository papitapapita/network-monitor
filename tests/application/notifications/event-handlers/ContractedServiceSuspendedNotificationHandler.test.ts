// Source: src/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.ts

import { ContractedServiceSuspendedNotificationHandler } from '../../../../src/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler';
import { SendSuspensionNoticeUseCase } from '../../../../src/application/notifications/use-cases/SendSuspensionNoticeUseCase';
import { ContractedServiceStatusChangedEvent } from '../../../../src/domain/customers/events/ContractedServiceStatusChangedEvent';
import { ContractedServiceStatus } from '../../../../src/domain/customers/enums/ContractedServiceStatus';
import { ContractedServiceId } from '../../../../src/domain/shared/ids/ContractedServiceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const CS_UUID = '550e8400-e29b-41d4-a716-446655440070';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeUseCase(): jest.Mocked<
  Pick<SendSuspensionNoticeUseCase, 'execute'>
> {
  return { execute: jest.fn() };
}

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

describe('ContractedServiceSuspendedNotificationHandler', () => {
  let useCase: jest.Mocked<
    Pick<SendSuspensionNoticeUseCase, 'execute'>
  >;
  let logger: jest.Mocked<ILogger>;
  let handler: ContractedServiceSuspendedNotificationHandler;

  beforeEach(() => {
    useCase = makeUseCase();
    logger = makeLogger();
    handler = new ContractedServiceSuspendedNotificationHandler(
      useCase as unknown as SendSuspensionNoticeUseCase,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transition filtering', () => {
    it('should send a notice on ACTIVE → SUSPENDED', async () => {
      useCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          customerId: 'c',
          sentAt: FIXED_DATE.toISOString()
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.ACTIVE,
          ContractedServiceStatus.SUSPENDED
        )
      );

      expect(useCase.execute).toHaveBeenCalledWith({
        contractedServiceId: CS_UUID
      });
    });

    it('should send a notice on PENDING → SUSPENDED', async () => {
      useCase.execute.mockResolvedValue(
        Result.ok({
          contractedServiceId: CS_UUID,
          customerId: 'c',
          sentAt: FIXED_DATE.toISOString()
        })
      );

      await handler.handle(
        makeEvent(
          ContractedServiceStatus.PENDING,
          ContractedServiceStatus.SUSPENDED
        )
      );

      expect(useCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should NOT send a notice on SUSPENDED → ACTIVE', async () => {
      await handler.handle(
        makeEvent(
          ContractedServiceStatus.SUSPENDED,
          ContractedServiceStatus.ACTIVE
        )
      );

      expect(useCase.execute).not.toHaveBeenCalled();
    });

    it('should NOT send a notice on PENDING → ACTIVE', async () => {
      await handler.handle(
        makeEvent(
          ContractedServiceStatus.PENDING,
          ContractedServiceStatus.ACTIVE
        )
      );

      expect(useCase.execute).not.toHaveBeenCalled();
    });

    it('should NOT send a notice on SUSPENDED → CANCELLED', async () => {
      await handler.handle(
        makeEvent(
          ContractedServiceStatus.SUSPENDED,
          ContractedServiceStatus.CANCELLED
        )
      );

      expect(useCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('failure isolation', () => {
    it('should only log when the use case fails', async () => {
      useCase.execute.mockResolvedValue(Result.fail('provider down'));

      await expect(
        handler.handle(
          makeEvent(
            ContractedServiceStatus.ACTIVE,
            ContractedServiceStatus.SUSPENDED
          )
        )
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'ContractedServiceSuspendedNotificationHandler: use case failed',
        undefined,
        { error: 'provider down' }
      );
    });

    it('should only log when the use case throws', async () => {
      useCase.execute.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(
          makeEvent(
            ContractedServiceStatus.ACTIVE,
            ContractedServiceStatus.SUSPENDED
          )
        )
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'ContractedServiceSuspendedNotificationHandler: unexpected error',
        expect.any(Error)
      );
    });
  });
});
