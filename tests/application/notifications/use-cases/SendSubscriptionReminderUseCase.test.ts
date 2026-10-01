import {
  REMINDER_LEAD_DAYS,
  SendSubscriptionReminderUseCase
} from '../../../../src/application/notifications/use-cases/SendSubscriptionReminderUseCase';
import { GetSubscriptionStatusUseCase } from '../../../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import { INotificationService } from '../../../../src/application/notifications/interfaces/INotificationService';
import { SubscriptionTerms } from '../../../../src/domain/shared/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';
import { vendorSettingsRepoWithTerms } from '../../../fixtures/vendorSettings';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SendSubscriptionReminderUseCase', () => {
  let notifications: jest.Mocked<INotificationService>;

  beforeEach(() => {
    notifications = {
      send: jest.fn().mockResolvedValue(Result.ok())
    };
  });

  // Grace 3 days, read-only 7 days; the paid period ends `offsetMs` from now.
  function useCaseEndingIn(offsetMs: number | null) {
    const terms =
      offsetMs === null
        ? null
        : SubscriptionTerms.create(
            new Date(Date.now() + offsetMs),
            3,
            7
          ).value;
    return new SendSubscriptionReminderUseCase(
      new GetSubscriptionStatusUseCase(
        vendorSettingsRepoWithTerms(terms),
        makeLogger()
      ),
      notifications,
      makeLogger()
    );
  }

  const body = () => notifications.send.mock.calls[0][0].body;

  it('[INS-027] sends nothing when no terms are set', async () => {
    const result = await useCaseEndingIn(null).execute();

    expect(result.value).toBe('NOT_DUE');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('[INS-027] sends nothing while the end is more than 5 days away', async () => {
    const result = await useCaseEndingIn(
      (REMINDER_LEAD_DAYS + 1) * DAY_MS
    ).execute();

    expect(result.value).toBe('NOT_DUE');
  });

  it('[INS-027] warns in the 5 days before the end', async () => {
    const result = await useCaseEndingIn(2 * DAY_MS).execute();

    expect(result.value).toBe('SENT');
    expect(body()).toContain('vence');
  });

  it('[INS-027] warns during grace that the service turns read-only', async () => {
    await useCaseEndingIn(-DAY_MS).execute();

    expect(body()).toContain('solo lectura');
  });

  it('[INS-027] warns while read-only that the dashboard will lock', async () => {
    await useCaseEndingIn(-5 * DAY_MS).execute();

    expect(body()).toContain('bloquea');
  });

  it('[INS-027] tells once, on the day it locks', async () => {
    await useCaseEndingIn(-10 * DAY_MS - 60_000).execute();
    expect(body()).toContain('bloqueado');

    notifications.send.mockClear();
    const later = await useCaseEndingIn(-12 * DAY_MS).execute();
    expect(later.value).toBe('NOT_DUE');
  });

  it('fails when the message cannot be sent', async () => {
    notifications.send.mockResolvedValue(
      Result.fail('telegram down')
    );

    const result = await useCaseEndingIn(2 * DAY_MS).execute();

    expect(result.isFailure).toBe(true);
  });
});
