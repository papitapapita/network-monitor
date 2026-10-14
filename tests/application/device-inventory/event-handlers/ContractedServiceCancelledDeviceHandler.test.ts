// Source: src/application/device-inventory/event-handlers/ContractedServiceCancelledDeviceHandler.ts

import { ContractedServiceCancelledDeviceHandler } from '../../../../src/application/device-inventory/event-handlers/ContractedServiceCancelledDeviceHandler';
import { RetireDeviceAfterCancellationUseCase } from '../../../../src/application/device-inventory/use-cases/RetireDeviceAfterCancellationUseCase';
import { ContractedServiceCancelledEvent } from '../../../../src/domain/customers/events';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import {
  ContractedServiceId,
  DeviceId
} from '../../../../src/domain/shared/ids';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as jest.Mocked<ILogger>;
}

function makeEvent(
  releasedDeviceId: DeviceId | null
): ContractedServiceCancelledEvent {
  return new ContractedServiceCancelledEvent({
    aggregateId: ContractedServiceId.create(),
    releasedDeviceId,
    dateTimeOccurred: new Date()
  });
}

describe('ContractedServiceCancelledDeviceHandler', () => {
  let useCase: { execute: jest.Mock };
  let logger: jest.Mocked<ILogger>;
  let handler: ContractedServiceCancelledDeviceHandler;

  beforeEach(() => {
    useCase = { execute: jest.fn() };
    logger = makeLogger();
    handler = new ContractedServiceCancelledDeviceHandler(
      useCase as unknown as RetireDeviceAfterCancellationUseCase,
      logger
    );
  });

  it('[DEV-173] retires the released device', async () => {
    const deviceId = DeviceId.create();
    useCase.execute.mockResolvedValue(
      Result.ok({ deviceId: deviceId.toString(), outcome: 'RETIRED' })
    );

    await handler.handle(makeEvent(deviceId));

    expect(useCase.execute).toHaveBeenCalledWith({
      deviceId: deviceId.toString()
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does nothing when the service had no device', async () => {
    await handler.handle(makeEvent(null));

    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it('logs and swallows a failure', async () => {
    useCase.execute.mockResolvedValue(Result.fail('boom'));

    await expect(
      handler.handle(makeEvent(DeviceId.create()))
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs and swallows a thrown error', async () => {
    useCase.execute.mockRejectedValue(new Error('crash'));

    await expect(
      handler.handle(makeEvent(DeviceId.create()))
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});
