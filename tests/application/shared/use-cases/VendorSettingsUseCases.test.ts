// Source: src/application/shared/use-cases/GetVendorSettingsUseCase.ts,
// UpdateVendorSettingsUseCase.ts

import { GetVendorSettingsUseCase } from '../../../../src/application/shared/use-cases/GetVendorSettingsUseCase';
import { UpdateVendorSettingsUseCase } from '../../../../src/application/shared/use-cases/UpdateVendorSettingsUseCase';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';
import {
  makeVendorSettingsProps,
  vendorSettingsRepo
} from '../../../fixtures/vendorSettings';

describe('GetVendorSettingsUseCase', () => {
  it('returns the current settings', async () => {
    const result = await new GetVendorSettingsUseCase(
      vendorSettingsRepo({ vendorTelegramChatId: '8468052749' }),
      makeLogger()
    ).execute({});

    expect(result.value).toEqual(
      makeVendorSettingsProps({ vendorTelegramChatId: '8468052749' })
    );
  });

  it('fails when they cannot be read', async () => {
    const repo = vendorSettingsRepo();
    repo.get.mockResolvedValue(Result.fail('DB down'));

    const result = await new GetVendorSettingsUseCase(
      repo,
      makeLogger()
    ).execute({});

    expect(result.error).toBe(
      'Failed to load vendor settings: DB down'
    );
  });
});

describe('[INS-028] UpdateVendorSettingsUseCase', () => {
  it('saves and returns the normalized settings', async () => {
    const repo = vendorSettingsRepo();

    const result = await new UpdateVendorSettingsUseCase(
      repo,
      makeLogger()
    ).execute(
      makeVendorSettingsProps({
        subscriptionPaidUntil: ' 2026-12-31 ',
        alertRetentionDays: 30
      })
    );

    expect(result.value.subscriptionPaidUntil).toBe('2026-12-31');
    expect(result.value.alertRetentionDays).toBe(30);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('saves nothing when a value is refused', async () => {
    const repo = vendorSettingsRepo();

    const result = await new UpdateVendorSettingsUseCase(
      repo,
      makeLogger()
    ).execute(
      makeVendorSettingsProps({ pingResultRetentionDays: 0 })
    );

    expect(result.error).toContain('pingResultRetentionDays');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the save fails', async () => {
    const repo = vendorSettingsRepo();
    repo.save.mockResolvedValue(Result.fail('DB down'));

    const result = await new UpdateVendorSettingsUseCase(
      repo,
      makeLogger()
    ).execute(makeVendorSettingsProps());

    expect(result.error).toBe(
      'Failed to save vendor settings: DB down'
    );
  });
});
