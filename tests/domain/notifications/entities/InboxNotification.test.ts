// Source: src/domain/notifications/entities/InboxNotification.ts

import {
  InboxNotification,
  InboxNotificationInput
} from '../../../../src/domain/notifications/entities/InboxNotification';
import { AlertSeverity } from '../../../../src/domain/shared/enums';

const USER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const DEVICE_ID = '0b6c1f5e-2a4d-4e8b-9c3d-7e6f5a4b3c2d';
const OCCURRED_AT = new Date('2026-10-27T14:00:00.000Z');

function makeInput(
  overrides: Partial<InboxNotificationInput> = {}
): InboxNotificationInput {
  return {
    userId: USER_ID,
    severity: AlertSeverity.CRITICAL,
    resolved: false,
    type: 'device_unreachable',
    title: 'AP Norte no responde desde las 9:00',
    body: null,
    deviceId: DEVICE_ID,
    occurredAt: OCCURRED_AT,
    ...overrides
  };
}

describe('InboxNotification', () => {
  describe('create', () => {
    it('[NOT-260] creates an unread notification for one user', () => {
      const result = InboxNotification.create(makeInput());

      expect(result.isSuccess).toBe(true);
      const notification = result.value;
      expect(notification.userId).toBe(USER_ID);
      expect(notification.isRead).toBe(false);
      expect(notification.readAt).toBeNull();
      expect(notification.alertId).toBeNull();
    });

    it('trims the title and turns a blank body into null', () => {
      const notification = InboxNotification.create(
        makeInput({ title: '  Caída  ', body: '   ' })
      ).value;

      expect(notification.title).toBe('Caída');
      expect(notification.body).toBeNull();
    });

    it.each([
      ['userId', { userId: '  ' }, 'userId is required'],
      ['type', { type: '' }, 'type is required'],
      ['title', { title: ' ' }, 'title is required'],
      [
        'a long type',
        { type: 'x'.repeat(101) },
        'type must be at most 100 characters'
      ],
      [
        'an invalid date',
        { occurredAt: new Date('nope') },
        'occurredAt must be a valid date'
      ],
      [
        'an unknown severity',
        { severity: 'INFO' as AlertSeverity },
        'severity must be WARNING or CRITICAL'
      ]
    ])('rejects %s', (_label, overrides, error) => {
      const result = InboxNotification.create(makeInput(overrides));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });

    it('rejects a missing title', () => {
      const input = makeInput();
      delete (input as Partial<InboxNotificationInput>).title;

      expect(InboxNotification.create(input).isFailure).toBe(true);
    });
  });

  describe('[NOT-264] category', () => {
    it.each([
      ['device_unreachable', 'device'],
      ['device_discovered', 'device'],
      ['port_speed_low', 'device'],
      ['router_rebooted', 'device'],
      ['router_health', 'device'],
      ['port_health', 'device'],
      ['wireless:signal_dbm:CRITICAL', 'wireless'],
      ['agent_offline', 'agent'],
      ['agent_clock', 'agent'],
      ['backup_failing', 'backup'],
      ['sign_in_paused', 'security'],
      ['two_factor_reset', 'security'],
      ['subscription_reminder', 'other']
    ])('files %s under %s', (type, category) => {
      const notification = InboxNotification.create(
        makeInput({ type })
      ).value;

      expect(notification.category).toBe(category);
    });
  });

  describe('dedupKey', () => {
    it('is the same for a retried delivery of the same notice', () => {
      const first = InboxNotification.create(makeInput()).value;
      const retry = InboxNotification.create(
        makeInput({ title: 'Otro texto' })
      ).value;

      expect(retry.dedupKey).toBe(first.dedupKey);
    });

    it('differs between an outage and its recovery', () => {
      const down = InboxNotification.create(makeInput()).value;
      const up = InboxNotification.create(
        makeInput({ resolved: true })
      ).value;

      expect(up.dedupKey).not.toBe(down.dedupKey);
    });

    it('differs for a later outage of the same device', () => {
      const first = InboxNotification.create(makeInput()).value;
      const later = InboxNotification.create(
        makeInput({ occurredAt: new Date('2026-10-27T18:00:00Z') })
      ).value;

      expect(later.dedupKey).not.toBe(first.dedupKey);
    });

    it('names the install when there is no device', () => {
      const notification = InboxNotification.create(
        makeInput({ deviceId: null, type: 'agent_offline' })
      ).value;

      expect(notification.dedupKey).toContain('|install|');
    });
  });

  describe('[NOT-262] markRead', () => {
    it('stamps the time it was read', () => {
      const notification =
        InboxNotification.create(makeInput()).value;
      const at = new Date('2026-10-27T15:00:00Z');

      notification.markRead(at);

      expect(notification.isRead).toBe(true);
      expect(notification.readAt).toEqual(at);
    });

    it('keeps the first read time when read again', () => {
      const notification =
        InboxNotification.create(makeInput()).value;
      const first = new Date('2026-10-27T15:00:00Z');

      notification.markRead(first);
      notification.markRead(new Date('2026-10-27T16:00:00Z'));

      expect(notification.readAt).toEqual(first);
    });
  });
});
