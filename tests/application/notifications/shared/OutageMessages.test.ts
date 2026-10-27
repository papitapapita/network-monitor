// Source: src/application/notifications/shared/OutageMessages.ts

import { OutageMessages } from '../../../../src/application/notifications/shared/OutageMessages';
import { AffectedDeviceDTO } from '../../../../src/application/notifications/dtos/AffectedDeviceDTO';

function device(
  deviceId: string,
  overrides: Partial<AffectedDeviceDTO> = {}
): AffectedDeviceDTO {
  return {
    deviceId,
    name: `Cliente ${deviceId}`,
    ipAddress: null,
    status: 'DOWN',
    viaDeviceId: null,
    viaDeviceName: null,
    ...overrides
  };
}

function many(count: number): AffectedDeviceDTO[] {
  return Array.from({ length: count }, (_, i) => device(`c${i + 1}`));
}

describe('OutageMessages', () => {
  describe('[NOT-243] chatList()', () => {
    it('is null with nothing affected', () => {
      expect(OutageMessages.chatList([])).toBeNull();
    });

    it('lists each device with its IP under a count', () => {
      const text = OutageMessages.chatList([
        device('a', {
          name: 'Cliente Pérez',
          ipAddress: '10.0.3.21'
        }),
        device('b', { name: 'Cliente Gómez' })
      ]);

      expect(text).toBe(
        'Afectados (2):\n• Cliente Pérez — 10.0.3.21\n• Cliente Gómez'
      );
    });

    it('groups devices behind an affected intermediate device', () => {
      const text = OutageMessages.chatList([
        device('sw', { name: 'Switch Barrio Sur' }),
        device('r', {
          name: 'Cliente Ruiz',
          viaDeviceId: 'sw',
          viaDeviceName: 'Switch Barrio Sur'
        }),
        device('d', {
          name: 'Cliente Díaz',
          viaDeviceId: 'sw',
          viaDeviceName: 'Switch Barrio Sur'
        })
      ]);

      expect(text).toBe(
        'Afectados (3):\n• Switch Barrio Sur → Cliente Ruiz, Cliente Díaz'
      );
    });

    it('puts a deeper device under the group at the top of its chain', () => {
      const text = OutageMessages.chatList([
        device('sw', { name: 'Switch' }),
        device('ap', { name: 'AP', viaDeviceId: 'sw' }),
        device('cpe', { name: 'CPE', viaDeviceId: 'ap' })
      ]);

      expect(text).toBe('Afectados (3):\n• Switch → AP, CPE');
    });

    it('names 30 devices at most, then points to the dashboard', () => {
      const text = OutageMessages.chatList(many(32)) as string;
      const lines = text.split('\n');

      expect(lines).toHaveLength(32);
      expect(lines.at(-1)).toBe('…y 2 más (ver panel)');
    });

    it('cuts a group short when it crosses the cap', () => {
      const members = Array.from({ length: 40 }, (_, i) =>
        device(`m${i}`, { name: `M${i}`, viaDeviceId: 'sw' })
      );
      const text = OutageMessages.chatList([
        device('sw', { name: 'Switch' }),
        ...members
      ]) as string;

      expect(text.split('\n')[1].split(', ')).toHaveLength(29);
      expect(text).toContain('…y 11 más (ver panel)');
    });
  });

  describe('[NOT-243] pushList()', () => {
    it('names the first three and counts the rest', () => {
      expect(OutageMessages.pushList(many(5))).toBe(
        'Afectados (5): Cliente c1, Cliente c2, Cliente c3 y 2 más'
      );
    });

    it('names all of three or fewer', () => {
      expect(OutageMessages.pushList(many(2))).toBe(
        'Afectados (2): Cliente c1, Cliente c2'
      );
    });

    it('is null with nothing affected', () => {
      expect(OutageMessages.pushList([])).toBeNull();
    });
  });

  describe('[NOT-243] ticketList()', () => {
    it('lists every device, with the device it hangs from', () => {
      const text = OutageMessages.ticketList([
        ...many(40),
        device('x', {
          name: 'Cliente X',
          ipAddress: '10.0.0.9',
          viaDeviceName: 'AP Norte'
        })
      ]) as string;

      expect(text.split('\n')).toHaveLength(42);
      expect(text).toContain('- Cliente X — 10.0.0.9 (vía AP Norte)');
    });
  });

  describe('[NOT-245] recovery', () => {
    it('says who is still down', () => {
      const affected = [
        ...many(6).map((d) => ({ ...d, status: 'UP' as const })),
        device('r', { name: 'Cliente Ruiz' })
      ];

      expect(OutageMessages.recoveryChat(affected)).toBe(
        'Volvieron 6 de 7. Siguen caídos: Cliente Ruiz'
      );
    });

    it('says when every one came back', () => {
      const affected = many(3).map((d) => ({
        ...d,
        status: 'UP' as const
      }));

      expect(OutageMessages.recoveryChat(affected)).toBe(
        'Volvieron los 3 afectados.'
      );
    });

    it('caps the still-down names on a phone', () => {
      const affected = [device('up', { status: 'UP' }), ...many(5)];

      expect(OutageMessages.recoveryPush(affected)).toBe(
        'Volvieron 1 de 6. Siguen caídos: Cliente c1, Cliente c2, Cliente c3 y 2 más'
      );
    });

    it('says when none came back', () => {
      expect(OutageMessages.recoveryChat(many(2))).toBe(
        'Siguen caídos los 2 afectados: Cliente c1, Cliente c2'
      );
    });

    it('is null with nothing affected', () => {
      expect(OutageMessages.recoveryChat([])).toBeNull();
    });
  });
});
