import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import { loadSubscriptionTerms } from 'infrastructure/di/subscriptionTerms';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';

// No database: the terms come from the environment. Exercised here through
// the real loader, the way the container builds it.
describe('GetSubscriptionStatusUseCase — integration', () => {
  const logger = new WinstonLogger();

  it('[INS-020] is NOT_ENFORCED when the install sets no terms', async () => {
    const useCase = new GetSubscriptionStatusUseCase(
      loadSubscriptionTerms({}),
      logger
    );

    const result = await useCase.execute();

    expect(result.value.state).toBe('NOT_ENFORCED');
    expect(result.value.readOnly).toBe(false);
  });

  it('[INS-020] is ACTIVE for a date far ahead, with the default stages', async () => {
    const useCase = new GetSubscriptionStatusUseCase(
      loadSubscriptionTerms({
        SUBSCRIPTION_PAID_UNTIL: '2099-12-31'
      }),
      logger
    );

    const result = await useCase.execute();

    expect(result.value).toEqual({
      state: 'ACTIVE',
      paidThrough: '2100-01-01T05:00:00.000Z',
      graceEndsAt: '2100-01-04T05:00:00.000Z',
      lockedAt: '2100-01-11T05:00:00.000Z',
      readOnly: false,
      locked: false
    });
  });

  it('[INS-020] is LOCKED long after the last paid day', async () => {
    const useCase = new GetSubscriptionStatusUseCase(
      loadSubscriptionTerms({
        SUBSCRIPTION_PAID_UNTIL: '2020-01-31'
      }),
      logger
    );

    const result = await useCase.execute();

    expect(result.value.state).toBe('LOCKED');
  });
});
