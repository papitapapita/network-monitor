// Source: src/application/billing/use-cases/GetBillingSettingsUseCase.ts,
// UpdateBillingSettingsUseCase.ts

import { GetBillingSettingsUseCase } from '../../../../src/application/billing/use-cases/GetBillingSettingsUseCase';
import { UpdateBillingSettingsUseCase } from '../../../../src/application/billing/use-cases/UpdateBillingSettingsUseCase';
import { IBillingSettingsRepository } from '../../../../src/domain/billing/repository';
import {
  BillingMode,
  BillingSettings
} from '../../../../src/domain/billing';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';

function makeRepo(
  settings = BillingSettings.defaults()
): jest.Mocked<IBillingSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(Result.ok(settings)),
    save: jest.fn().mockResolvedValue(Result.ok())
  };
}

const SAVED = {
  automaticBillingEnabled: true,
  billingMode: BillingMode.ARREARS,
  issueLeadDays: 7,
  graceDays: 2,
  automaticCutEnabled: false,
  reminderWhatsAppTemplate: null
};

describe('GetBillingSettingsUseCase', () => {
  it('[BIL-281] returns the current settings', async () => {
    const useCase = new GetBillingSettingsUseCase(
      makeRepo(),
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      automaticBillingEnabled: false,
      billingMode: 'ADVANCE',
      issueLeadDays: 5,
      graceDays: 3,
      automaticCutEnabled: false,
      reminderWhatsAppTemplate: null
    });
  });

  it('fails when the settings cannot be read', async () => {
    const repo = makeRepo();
    repo.get.mockResolvedValue(Result.fail('DB down'));
    const useCase = new GetBillingSettingsUseCase(repo, makeLogger());

    const result = await useCase.execute({});

    expect(result.error).toBe(
      'Failed to load billing settings: DB down'
    );
  });
});

describe('[BIL-280] UpdateBillingSettingsUseCase', () => {
  it('saves and returns the new settings', async () => {
    const repo = makeRepo();
    const useCase = new UpdateBillingSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute(SAVED);

    expect(result.value).toEqual(SAVED);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][0].issueLeadDays).toBe(7);
  });

  it('saves nothing when a value is refused', async () => {
    const repo = makeRepo();
    const useCase = new UpdateBillingSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({ ...SAVED, graceDays: 30 });

    expect(result.error).toContain('graceDays');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the save fails', async () => {
    const repo = makeRepo();
    repo.save.mockResolvedValue(Result.fail('DB down'));
    const useCase = new UpdateBillingSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute(SAVED);

    expect(result.error).toBe(
      'Failed to save billing settings: DB down'
    );
  });
});
