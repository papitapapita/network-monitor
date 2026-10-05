import { TelegramFormatting } from '../../../../src/application/notifications/shared/TelegramFormatting';

describe('TelegramFormatting', () => {
  describe('[NOT-094] formatSince', () => {
    const NOW = new Date('2026-10-05T20:00:00.000Z'); // 15:00 in Bogotá

    it('should give only the time for earlier the same Bogotá day', () => {
      expect(
        TelegramFormatting.formatSince(
          new Date('2026-10-05T17:05:00.000Z'),
          NOW
        )
      ).toBe('las 12:05');
    });

    it('should add the day for an earlier Bogotá day, even when UTC agrees', () => {
      expect(
        TelegramFormatting.formatSince(
          new Date('2026-10-05T03:30:00.000Z'),
          NOW
        )
      ).toBe('el 04/10 a las 22:30');
    });
  });

  describe('[NOT-092] link', () => {
    it('should escape the label and only ) and \\ in the target', () => {
      expect(
        TelegramFormatting.link('10.0.0.1', 'http://10.0.0.1/a_(b)')
      ).toBe('[10\\.0\\.0\\.1](http://10.0.0.1/a_(b\\))');
    });
  });
});
