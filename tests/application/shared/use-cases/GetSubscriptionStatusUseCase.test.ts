import { GetSubscriptionStatusUseCase } from '../../../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import { SubscriptionTerms } from '../../../../src/domain/shared/value-objects';
import { makeLogger } from '../../probe-agents/fixtures';
import { vendorSettingsRepoWithTerms } from '../../../fixtures/vendorSettings';
import { Result } from '../../../../src/domain/shared/core/Result';

const DAY_MS = 24 * 60 * 60 * 1000;

// Grace 3 days, read-only 7 days, paid period ending `offsetMs` from now.
function termsEndingIn(offsetMs: number) {
  return SubscriptionTerms.create(
    new Date(Date.now() + offsetMs),
    3,
    7
  ).value;
}

describe('GetSubscriptionStatusUseCase', () => {
  it('[INS-020] reports NOT_ENFORCED without terms', async () => {
    const result = await new GetSubscriptionStatusUseCase(
      vendorSettingsRepoWithTerms(null),
      makeLogger()
    ).execute();

    expect(result.value).toEqual({
      state: 'NOT_ENFORCED',
      paidThrough: null,
      graceEndsAt: null,
      lockedAt: null,
      readOnly: false,
      locked: false
    });
  });

  it.each([
    ['ACTIVE', DAY_MS, false, false],
    ['GRACE', -DAY_MS, false, false],
    ['READ_ONLY', -5 * DAY_MS, true, false],
    ['LOCKED', -20 * DAY_MS, true, true]
  ] as const)(
    '[INS-020] reports %s with readOnly=%s, locked=%s',
    async (state, offsetMs, readOnly, locked) => {
      const terms = termsEndingIn(offsetMs);

      const result = await new GetSubscriptionStatusUseCase(
        vendorSettingsRepoWithTerms(terms),
        makeLogger()
      ).execute();

      expect(result.value).toEqual({
        state,
        paidThrough: terms.paidThrough.toISOString(),
        graceEndsAt: terms.graceEndsAt.toISOString(),
        lockedAt: terms.lockedAt.toISOString(),
        readOnly,
        locked
      });
    }
  );

  it('[INS-028] fails when the settings cannot be read, so callers fail open', async () => {
    const repo = vendorSettingsRepoWithTerms(null);
    repo.get.mockResolvedValue(Result.fail('DB down'));

    const result = await new GetSubscriptionStatusUseCase(
      repo,
      makeLogger()
    ).execute();

    expect(result.error).toBe(
      'Failed to read the subscription terms: DB down'
    );
  });
});
