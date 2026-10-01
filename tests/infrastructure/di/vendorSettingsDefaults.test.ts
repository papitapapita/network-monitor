// Source: src/infrastructure/di/vendorSettingsDefaults.ts

import {
  DEFAULT_GRACE_DAYS,
  DEFAULT_READ_ONLY_DAYS,
  loadVendorSettingsDefaults
} from '../../../src/infrastructure/di/vendorSettingsDefaults';

const PAID = { SUBSCRIPTION_PAID_UNTIL: '2026-10-31' };

describe('[INS-029] loadVendorSettingsDefaults', () => {
  it('[INS-021] is not enforced when the paid-until date is unset or blank', () => {
    expect(
      loadVendorSettingsDefaults({}).subscriptionTerms()
    ).toBeNull();
    expect(
      loadVendorSettingsDefaults({
        SUBSCRIPTION_PAID_UNTIL: '  '
      }).subscriptionTerms()
    ).toBeNull();
  });

  it('[INS-021] covers the whole last day in Colombian time', () => {
    const terms = loadVendorSettingsDefaults({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '2',
      SUBSCRIPTION_READ_ONLY_DAYS: '4'
    }).subscriptionTerms()!;

    expect(terms.paidThrough.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z'
    );
    expect(terms.graceDays).toBe(2);
    expect(terms.readOnlyDays).toBe(4);
  });

  it('[INS-021] defaults to 3 grace days and 7 read-only days', () => {
    const settings = loadVendorSettingsDefaults(PAID);

    expect(DEFAULT_GRACE_DAYS).toBe(3);
    expect(DEFAULT_READ_ONLY_DAYS).toBe(7);
    expect(settings.subscriptionGraceDays).toBe(3);
    expect(settings.subscriptionReadOnlyDays).toBe(7);
  });

  it('[INS-021] accepts zero for either stage', () => {
    const terms = loadVendorSettingsDefaults({
      ...PAID,
      SUBSCRIPTION_GRACE_DAYS: '0',
      SUBSCRIPTION_READ_ONLY_DAYS: '0'
    }).subscriptionTerms()!;

    expect(terms.graceDays).toBe(0);
    expect(terms.readOnlyDays).toBe(0);
  });

  it('reads the vendor chat and the retention windows', () => {
    const settings = loadVendorSettingsDefaults({
      TELEGRAM_VENDOR_CHAT_ID: '8468052749',
      PING_RESULT_RETENTION_DAYS: '15',
      ALERT_RETENTION_DAYS: '60',
      WIRELESS_SNAPSHOT_RETENTION_DAYS: '10',
      WIRELESS_ALERT_RECORD_RETENTION_DAYS: '45'
    });

    expect(settings.vendorTelegramChatId).toBe('8468052749');
    expect(settings.pingResultRetentionDays).toBe(15);
    expect(settings.alertRetentionDays).toBe(60);
    expect(settings.wirelessSnapshotRetentionDays).toBe(10);
    expect(settings.wirelessAlertRecordRetentionDays).toBe(45);
  });

  it('falls back to no vendor chat and 30/90/30/90 retention days', () => {
    const settings = loadVendorSettingsDefaults({});

    expect(settings.vendorTelegramChatId).toBeNull();
    expect(settings.pingResultRetentionDays).toBe(30);
    expect(settings.alertRetentionDays).toBe(90);
    expect(settings.wirelessSnapshotRetentionDays).toBe(30);
    expect(settings.wirelessAlertRecordRetentionDays).toBe(90);
  });

  it.each([
    '31/10/2026',
    '2026-02-30',
    '2026-13-01',
    '2026-10-31T00:00'
  ])('[INS-021] stops the boot on a malformed date %s', (raw) => {
    expect(() =>
      loadVendorSettingsDefaults({ SUBSCRIPTION_PAID_UNTIL: raw })
    ).toThrow('SUBSCRIPTION_PAID_UNTIL');
  });

  it.each([
    ['SUBSCRIPTION_GRACE_DAYS', '-1'],
    ['SUBSCRIPTION_GRACE_DAYS', 'seven'],
    ['SUBSCRIPTION_GRACE_DAYS', '91'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '1.5'],
    ['SUBSCRIPTION_READ_ONLY_DAYS', '91'],
    ['PING_RESULT_RETENTION_DAYS', '0'],
    ['ALERT_RETENTION_DAYS', 'forever'],
    ['TELEGRAM_VENDOR_CHAT_ID', 'my-chat']
  ])('stops the boot on %s=%s, naming the variable', (name, raw) => {
    expect(() =>
      loadVendorSettingsDefaults({ ...PAID, [name]: raw })
    ).toThrow(new RegExp(`^${name}: `));
  });
});
