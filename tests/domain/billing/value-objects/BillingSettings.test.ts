// Source: src/domain/billing/value-objects/BillingSettings.ts

import { describe, it, expect } from '@jest/globals';
import {
  BillingMode,
  BillingSettings
} from '../../../../src/domain/billing';

const VALID = {
  automaticBillingEnabled: true,
  billingMode: BillingMode.ARREARS,
  issueLeadDays: 7,
  graceDays: 2,
  automaticCutEnabled: false
};

describe('BillingSettings', () => {
  it('[BIL-281] defaults to off, in advance, issued 5 days ahead, 3 grace days', () => {
    const defaults = BillingSettings.defaults();

    expect(defaults.automaticBillingEnabled).toBe(false);
    expect(defaults.billingMode).toBe(BillingMode.ADVANCE);
    expect(defaults.issueLeadDays).toBe(5);
    expect(defaults.graceDays).toBe(3);
  });

  it('[BIL-310] the automatic cut is off by default', () => {
    expect(BillingSettings.defaults().automaticCutEnabled).toBe(
      false
    );
  });

  it('[BIL-280] refuses a cut switch that is not true or false', () => {
    const result = BillingSettings.create({
      ...VALID,
      automaticCutEnabled: 'yes' as unknown as boolean
    });

    expect(result.error).toBe(
      'automaticCutEnabled must be true or false'
    );
  });

  it('[BIL-280] accepts valid settings', () => {
    const result = BillingSettings.create(VALID);

    expect(result.isSuccess).toBe(true);
    expect(result.value.billingMode).toBe(BillingMode.ARREARS);
    expect(result.value.issueLeadDays).toBe(7);
    expect(result.value.graceDays).toBe(2);
  });

  it('[BIL-280] accepts the range bounds', () => {
    expect(
      BillingSettings.create({
        ...VALID,
        issueLeadDays: 1,
        graceDays: 0,
        automaticCutEnabled: false
      }).isSuccess
    ).toBe(true);
    expect(
      BillingSettings.create({
        ...VALID,
        issueLeadDays: 14,
        graceDays: 14,
        automaticCutEnabled: false
      }).isSuccess
    ).toBe(true);
  });

  it.each([0, 15, 2.5])(
    '[BIL-280] refuses %p lead days',
    (issueLeadDays) => {
      const result = BillingSettings.create({
        ...VALID,
        issueLeadDays
      });
      expect(result.error).toBe(
        'issueLeadDays must be a whole number from 1 to 14'
      );
    }
  );

  it.each([-1, 15, 1.5])(
    '[BIL-280] refuses %p grace days',
    (graceDays) => {
      const result = BillingSettings.create({ ...VALID, graceDays });
      expect(result.error).toBe(
        'graceDays must be a whole number from 0 to 14'
      );
    }
  );

  it('[BIL-280] refuses an unknown billing mode', () => {
    const result = BillingSettings.create({
      ...VALID,
      billingMode: 'MONTHLY' as BillingMode
    });
    expect(result.error).toBe(
      'billingMode must be one of ADVANCE, ARREARS'
    );
  });

  it('[BIL-280] refuses a non-boolean switch', () => {
    const result = BillingSettings.create({
      ...VALID,
      automaticBillingEnabled: 'yes' as unknown as boolean
    });
    expect(result.error).toBe(
      'automaticBillingEnabled must be true or false'
    );
  });
});
