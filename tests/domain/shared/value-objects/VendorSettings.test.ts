// Source: src/domain/shared/value-objects/VendorSettings.ts

import {
  VendorSettings,
  MAX_RETENTION_DAYS
} from '../../../../src/domain/shared/value-objects/VendorSettings';
import { makeVendorSettingsProps } from '../../../fixtures/vendorSettings';

describe('[INS-028] VendorSettings', () => {
  it('accepts the defaults', () => {
    expect(
      VendorSettings.create(makeVendorSettingsProps()).isSuccess
    ).toBe(true);
  });

  describe('vendorTelegramChatId', () => {
    it('trims it and treats blank as none', () => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({
            vendorTelegramChatId: ' 8468052749 '
          })
        ).value.vendorTelegramChatId
      ).toBe('8468052749');
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({ vendorTelegramChatId: '  ' })
        ).value.vendorTelegramChatId
      ).toBeNull();
    });

    it('refuses something Telegram would not accept', () => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ vendorTelegramChatId: 'jonathan' })
      );

      expect(result.error).toBe(
        'vendorTelegramChatId must be a numeric chat id or a @channel name'
      );
    });
  });

  describe('[INS-021] subscription', () => {
    it('is not enforced with no paid-until date', () => {
      const settings = VendorSettings.create(
        makeVendorSettingsProps()
      ).value;

      expect(settings.subscriptionTerms()).toBeNull();
    });

    it('covers the whole last paid day in Colombian time', () => {
      const terms = VendorSettings.create(
        makeVendorSettingsProps({
          subscriptionPaidUntil: '2026-10-31',
          subscriptionGraceDays: 2,
          subscriptionReadOnlyDays: 4
        })
      ).value.subscriptionTerms()!;

      expect(terms.paidThrough.toISOString()).toBe(
        '2026-11-01T05:00:00.000Z'
      );
      expect(terms.graceEndsAt.toISOString()).toBe(
        '2026-11-03T05:00:00.000Z'
      );
      expect(terms.lockedAt.toISOString()).toBe(
        '2026-11-07T05:00:00.000Z'
      );
    });

    it.each([
      '31/10/2026',
      '2026-02-30',
      '2026-13-01',
      '2026-10-31T00:00'
    ])('refuses the date %s', (date) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ subscriptionPaidUntil: date })
      );

      expect(result.error).toBe(
        'subscriptionPaidUntil must be a real date as YYYY-MM-DD'
      );
    });

    it.each([
      ['subscriptionGraceDays', 91, 'Grace days'],
      ['subscriptionReadOnlyDays', -1, 'Read-only days'],
      ['subscriptionGraceDays', 1.5, 'Grace days']
    ] as const)(
      'refuses %s=%d even with no date set',
      (field, value, label) => {
        const result = VendorSettings.create(
          makeVendorSettingsProps({ [field]: value })
        );

        expect(result.error).toBe(
          `${label} must be a whole number from 0 to 90`
        );
      }
    );
  });

  describe('retention windows', () => {
    it.each([1, MAX_RETENTION_DAYS])('accepts %d days', (days) => {
      expect(
        VendorSettings.create(
          makeVendorSettingsProps({ alertRetentionDays: days })
        ).isSuccess
      ).toBe(true);
    });

    it.each([
      ['pingResultRetentionDays', 0],
      ['alertRetentionDays', MAX_RETENTION_DAYS + 1],
      ['wirelessSnapshotRetentionDays', 2.5],
      ['wirelessAlertRecordRetentionDays', NaN]
    ] as const)('refuses %s=%d', (field, value) => {
      const result = VendorSettings.create(
        makeVendorSettingsProps({ [field]: value })
      );

      expect(result.error).toBe(
        `${field} must be a whole number from 1 to ${MAX_RETENTION_DAYS}`
      );
    });
  });
});
