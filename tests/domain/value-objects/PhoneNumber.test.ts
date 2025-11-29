import { PhoneNumber } from '../../../src/domain/value-objects/PhoneNumber';

// NOTE: Using a working Colombian mobile number as example
const VALID_CO_MOBILE = '+573001234567';

describe('PhoneNumber Value Object', () => {
  describe('successful creation', () => {
    it('should create a valid phone number with default country', () => {
      const result = PhoneNumber.create('3001234567', 'CO');

      expect(result.isSuccess).toBe(true);
      const phone = result.value;

      expect(phone.value).toBe('+573001234567'); // E.164
      expect(phone.country).toBe('CO');
      expect(phone.countryCode).toBe('57');
      expect(phone.nationalNumber).toBe('3001234567');
      expect(phone.formattedInternational).toContain('+57');
      expect(phone.formattedNational.length).toBeGreaterThan(0);
    });

    it('should create a valid phone number without default country (E.164 input)', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE);

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(VALID_CO_MOBILE);
      expect(result.value.formattedNational).toBe('300 1234567');
    });

    it('should trim whitespace and still work', () => {
      const result = PhoneNumber.create('   +573001234567   ');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(VALID_CO_MOBILE);
    });
  });

  describe('invalid creation cases', () => {
    it('should fail if null or undefined', () => {
      const result = PhoneNumber.create(undefined as any);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail on empty string', () => {
      const result = PhoneNumber.create('');

      expect(result.isSuccess).toBe(false);
    });

    it('should fail on invalid number for country', () => {
      const result = PhoneNumber.create('12345', 'CO');

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Invalid phone number format');
    });

    it('should fail if parsing throws an error', () => {
      // Force an invalid format that libphonenumber-js cannot parse
      const result = PhoneNumber.create('++---==invalid===', 'CO');

      expect(result.isSuccess).toBe(false);
    });
  });

  describe('type checks (MOBILE, FIXED_LINE)', () => {
    it('should correctly detect type MOBILE', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE);

      const phone = result.value;
      // depending on lib version: MOBILE or FIXED_LINE_OR_MOBILE
      expect(['MOBILE', 'FIXED_LINE_OR_MOBILE']).toContain(
        phone.type
      );
      expect(phone.canReceiveSMS()).toBe(true);
    });
  });

  describe('formatting functions', () => {
    it('formatFor() should return national format if same country', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE, 'CO');
      const phone = result.value;

      const formatted = phone.formatFor('CO');

      expect(formatted).toBe(phone.formattedNational);
    });

    it('formatFor() should return international format for other countries', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE, 'CO');
      const phone = result.value;

      const formatted = phone.formatFor('US');

      expect(formatted).toBe(phone.formattedInternational);
    });
  });

  describe('string/utility methods', () => {
    it('toURI() should generate tel: URI', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE);
      const phone = result.value;

      expect(phone.toURI()).toBe(`tel:${VALID_CO_MOBILE}`);
    });

    it('toE164() should return normalized E.164', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE);
      expect(result.value.toE164()).toBe(VALID_CO_MOBILE);
    });

    it('toString() should return international format', () => {
      const result = PhoneNumber.create(VALID_CO_MOBILE);
      const phone = result.value;

      expect(phone.toString()).toBe(phone.formattedInternational);
    });
  });

  describe('createFromE164()', () => {
    it('should create a number from E.164 format', () => {
      const result = PhoneNumber.createFromE164(VALID_CO_MOBILE);

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(VALID_CO_MOBILE);
    });
  });
});
