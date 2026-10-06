// Source: src/application/billing/event-handlers/RestoreServicesOnPaymentHandler.ts

import { RestoreServicesOnPaymentHandler } from '../../../../src/application/billing/event-handlers';
import { RestoreServicesAfterPaymentUseCase } from '../../../../src/application/billing/use-cases';
import { BillPaidEvent } from '../../../../src/domain/billing';
import {
  BillId,
  CustomerId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

describe('RestoreServicesOnPaymentHandler', () => {
  const customerId = CustomerId.create();
  const event = new BillPaidEvent({
    aggregateId: BillId.create(),
    customerId,
    paidAt: new Date('2026-10-12T15:00:00Z'),
    dateTimeOccurred: new Date('2026-10-12T15:00:00Z')
  });
  let execute: jest.Mock;
  let logger: ReturnType<typeof makeLogger>;
  let handler: RestoreServicesOnPaymentHandler;

  beforeEach(() => {
    execute = jest
      .fn()
      .mockResolvedValue(
        Result.ok({ attempted: true, restored: 1, failed: [] })
      );
    logger = makeLogger();
    handler = new RestoreServicesOnPaymentHandler(
      { execute } as unknown as RestoreServicesAfterPaymentUseCase,
      logger
    );
  });

  it("[BIL-311] asks to restore the paying customer's services", async () => {
    await handler.handle(event);

    expect(execute).toHaveBeenCalledWith({
      customerId: customerId.toString()
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs each service that could not be restored', async () => {
    execute.mockResolvedValue(
      Result.ok({
        attempted: true,
        restored: 0,
        failed: [{ id: 'svc-1', error: 'no device' }]
      })
    );

    await handler.handle(event);

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('logs a failure instead of throwing', async () => {
    execute.mockResolvedValue(Result.fail('DB down'));

    await expect(handler.handle(event)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs an unexpected error instead of throwing', async () => {
    execute.mockRejectedValue(new Error('boom'));

    await expect(handler.handle(event)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
