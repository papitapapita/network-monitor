import { PhoneNumber } from '../../../src/domain';

describe('PhoneNumber', () => {
  describe('create', () => {
    describe('when valid phone number', () => {
      it('should create PhoneNumber with Colombian mobile number and country code', () => {
        const result = PhoneNumber.create('3001234567', 'CO');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+573001234567');
        expect(result.value.country).toBe('CO');
        expect(result.value.countryCode).toBe('57');
        expect(result.value.nationalNumber).toBe('3001234567');
      });

      it('should create PhoneNumber with E.164 format', () => {
        const result = PhoneNumber.create('+573001234567');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+573001234567');
        expect(result.value.country).toBe('CO');
      });

      it('should create PhoneNumber with US number', () => {
        const result = PhoneNumber.create('4155552671', 'US');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+14155552671');
        expect(result.value.country).toBe('US');
        expect(result.value.countryCode).toBe('1');
      });

      it('should create PhoneNumber with international format input', () => {
        const result = PhoneNumber.create('+14155552671');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+14155552671');
      });

      it('should trim whitespace', () => {
        const result = PhoneNumber.create('  +573001234567  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+573001234567');
      });

      it('should create PhoneNumber with UK number', () => {
        const result = PhoneNumber.create('2079460123', 'GB');

        expect(result.isSuccess).toBe(true);
        expect(result.value.country).toBe('GB');
        expect(result.value.countryCode).toBe('44');
      });

      it('should normalize formatted national number', () => {
        const result = PhoneNumber.create('300 1234567', 'CO');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('+573001234567');
      });
    });

    describe('when invalid phone number', () => {
      it('should fail for null', () => {
        const result = PhoneNumber.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('phone');
      });

      it('should fail for undefined', () => {
        const result = PhoneNumber.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('phone');
      });

      it('should fail for empty string', () => {
        const result = PhoneNumber.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('at least 1');
      });

      it('should fail for whitespace only', () => {
        const result = PhoneNumber.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('at least 1');
      });

      it('should fail for invalid number format', () => {
        const result = PhoneNumber.create('12345', 'CO');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid phone number format');
      });

      it('should fail for too short number', () => {
        const result = PhoneNumber.create('123', 'US');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid phone number format');
      });

      it('should fail for invalid characters', () => {
        const result = PhoneNumber.create('++---==invalid===', 'CO');

        expect(result.isFailure).toBe(true);
        expect(result.error).toBeDefined();
      });

      it('should fail for letters in number', () => {
        const result = PhoneNumber.create('300ABC4567', 'CO');

        expect(result.isFailure).toBe(true);
        expect(result.error).toBeDefined();
      });

      it('should fail for invalid E.164 format', () => {
        const result = PhoneNumber.create('+99999999999999999');

        expect(result.isFailure).toBe(true);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('createFromE164', () => {
    it('should create PhoneNumber from E.164 format', () => {
      const result = PhoneNumber.createFromE164('+573001234567');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('+573001234567');
    });

    it('should create PhoneNumber from US E.164', () => {
      const result = PhoneNumber.createFromE164('+14155552671');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('+14155552671');
      expect(result.value.country).toBe('US');
    });

    it('should fail for invalid E.164 format', () => {
      const result = PhoneNumber.createFromE164('invalid');

      expect(result.isFailure).toBe(true);
    });
  });

  describe('isMobile', () => {
    it('should return true for mobile numbers', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      // Colombian mobile numbers can be MOBILE or FIXED_LINE_OR_MOBILE
      const isMobileType =
        phone.type === 'MOBILE' ||
        phone.type === 'FIXED_LINE_OR_MOBILE';

      expect(isMobileType).toBe(true);
    });
  });

  describe('isFixedLine', () => {
    it('should return true for fixed line numbers', () => {
      // US number that is typically fixed line
      const phone = PhoneNumber.create('2025551234', 'US').value;

      const isFixedLineType =
        phone.type === 'FIXED_LINE' ||
        phone.type === 'FIXED_LINE_OR_MOBILE';

      expect(isFixedLineType || phone.type === 'UNKNOWN').toBe(true);
    });
  });

  describe('canReceiveSMS', () => {
    it('should return true for mobile numbers', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.canReceiveSMS()).toBe(true);
    });
  });

  describe('formatFor', () => {
    it('should return national format for same country', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      const formatted = phone.formatFor('CO');

      expect(formatted).toBe(phone.formattedNational);
    });

    it('should return international format for different country', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      const formatted = phone.formatFor('US');

      expect(formatted).toBe(phone.formattedInternational);
    });

    it('should handle US number formatted for US', () => {
      const phone = PhoneNumber.create('4155552671', 'US').value;

      const formatted = phone.formatFor('US');

      expect(formatted).toBe(phone.formattedNational);
    });

    it('should handle US number formatted for CO', () => {
      const phone = PhoneNumber.create('4155552671', 'US').value;

      const formatted = phone.formatFor('CO');

      expect(formatted).toBe(phone.formattedInternational);
    });
  });

  describe('toURI', () => {
    it('should generate tel: URI format', () => {
      const phone = PhoneNumber.create('+573001234567').value;

      expect(phone.toURI()).toBe('tel:+573001234567');
    });

    it('should generate tel: URI for US number', () => {
      const phone = PhoneNumber.create('+14155552671').value;

      expect(phone.toURI()).toBe('tel:+14155552671');
    });
  });

  describe('toE164', () => {
    it('should return E.164 format', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.toE164()).toBe('+573001234567');
    });

    it('should return E.164 format for US number', () => {
      const phone = PhoneNumber.create('4155552671', 'US').value;

      expect(phone.toE164()).toBe('+14155552671');
    });

    it('should equal value getter', () => {
      const phone = PhoneNumber.create('+573001234567').value;

      expect(phone.toE164()).toBe(phone.value);
    });
  });

  describe('toString', () => {
    it('should return internationally formatted phone', () => {
      const phone = PhoneNumber.create('+573001234567').value;

      expect(phone.toString()).toBe(phone.formattedInternational);
    });

    it('should return formatted string for US number', () => {
      const phone = PhoneNumber.create('+14155552671').value;

      expect(phone.toString()).toBe(phone.formattedInternational);
    });
  });

  describe('getters', () => {
    it('should have correct value (E.164)', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.value).toBe('+573001234567');
    });

    it('should have correct countryCode', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.countryCode).toBe('57');
    });

    it('should have correct nationalNumber', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.nationalNumber).toBe('3001234567');
    });

    it('should have formattedInternational', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.formattedInternational).toContain('+57');
      expect(phone.formattedInternational).toContain('300');
    });

    it('should have formattedNational', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.formattedNational).toBe('300 1234567');
    });

    it('should have country', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.country).toBe('CO');
    });

    it('should have type', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.type).toBeDefined();
    });
  });

  describe('equals', () => {
    it('should return true for same phone numbers', () => {
      const phone1 = PhoneNumber.create('3001234567', 'CO').value;
      const phone2 = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone1.equals(phone2)).toBe(true);
    });

    it('should return true for phone numbers with same E.164', () => {
      const phone1 = PhoneNumber.create('+573001234567').value;
      const phone2 = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone1.equals(phone2)).toBe(true);
    });

    it('should return false for different phone numbers', () => {
      const phone1 = PhoneNumber.create('3001234567', 'CO').value;
      const phone2 = PhoneNumber.create('3009876543', 'CO').value;

      expect(phone1.equals(phone2)).toBe(false);
    });

    it('should return false for numbers from different countries', () => {
      const phone1 = PhoneNumber.create('3001234567', 'CO').value;
      const phone2 = PhoneNumber.create('4155552671', 'US').value;

      expect(phone1.equals(phone2)).toBe(false);
    });

    it('should return false for null', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(phone.equals(undefined as any)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        phone.props.value = '+14155552671';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const phone = PhoneNumber.create('3001234567', 'CO').value;

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      phone.props = {
        value: '+14155552671',
        countryCode: '1',
        nationalNumber: '4155552671',
        formattedInternational: '+1 415-555-2671',
        formattedNational: '(415) 555-2671',
        country: 'US',
        type: 'MOBILE'
      };
    });
  });
});
