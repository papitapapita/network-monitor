import { RadioHostname } from '../../../../src/domain/wireless-monitoring/value-objects/RadioHostname';

describe('[WLS-223] RadioHostname (wireless-monitoring)', () => {
  describe('create(raw)', () => {
    it('should accept a name like the ones AirOS ships with', () => {
      const result = RadioHostname.create('AP JDJF LLANERITA 1_');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('AP JDJF LLANERITA 1_');
    });

    it('should trim surrounding spaces', () => {
      const result = RadioHostname.create('  STA-Cliente.2  ');

      expect(result.value.value).toBe('STA-Cliente.2');
    });

    it('should accept exactly 32 characters', () => {
      expect(RadioHostname.create('a'.repeat(32)).isSuccess).toBe(
        true
      );
    });

    it('should reject 33 characters', () => {
      const result = RadioHostname.create('a'.repeat(33));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at most 32');
    });

    it.each(['', '   '])('should reject an empty name %j', (raw) => {
      const result = RadioHostname.create(raw);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('required');
    });

    it.each([
      "AP O'Brien",
      'AP/1',
      'AP Peña',
      'AP;reboot',
      'AP$(id)',
      'AP\nB',
      'AP&1',
      'AP\\1'
    ])('should reject %j', (raw) => {
      const result = RadioHostname.create(raw);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must be letters');
    });

    it('should reject null', () => {
      expect(
        RadioHostname.create(null as unknown as string).isFailure
      ).toBe(true);
    });

    it('should reject a non-string', () => {
      expect(
        RadioHostname.create(42 as unknown as string).isFailure
      ).toBe(true);
    });
  });
});
