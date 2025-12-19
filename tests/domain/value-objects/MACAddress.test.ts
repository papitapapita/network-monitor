import { MACAddress } from '../../../src/domain';

describe('MACAddress', () => {
  describe('create', () => {
    describe('when valid MAC address', () => {
      it('should create MACAddress with colon-separated format', () => {
        const result = MACAddress.create('AA:BB:CC:DD:EE:FF');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should create MACAddress with hyphen-separated format', () => {
        const result = MACAddress.create('AA-BB-CC-DD-EE-FF');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should normalize lowercase to uppercase', () => {
        const result = MACAddress.create('aa:bb:cc:dd:ee:ff');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should normalize lowercase hyphens to uppercase colons', () => {
        const result = MACAddress.create('aa-bb-cc-dd-ee-ff');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should normalize mixed case', () => {
        const result = MACAddress.create('Aa:Bb:Cc:Dd:Ee:Ff');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should trim whitespace', () => {
        const result = MACAddress.create('  AA:BB:CC:DD:EE:FF  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should trim and normalize together', () => {
        const result = MACAddress.create('  aa-bb-cc-dd-ee-ff  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
      });

      it('should accept all zeros MAC', () => {
        const result = MACAddress.create('00:00:00:00:00:00');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('00:00:00:00:00:00');
      });

      it('should accept all Fs MAC', () => {
        const result = MACAddress.create('FF:FF:FF:FF:FF:FF');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('FF:FF:FF:FF:FF:FF');
      });

      it('should accept valid hex characters', () => {
        const result = MACAddress.create('12:34:56:78:9A:BC');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('12:34:56:78:9A:BC');
      });

      it('should accept valid hex characters lowercase', () => {
        const result = MACAddress.create('12:34:56:78:9a:bc');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('12:34:56:78:9A:BC');
      });
    });

    describe('when invalid MAC address format', () => {
      it('should fail for too few segments', () => {
        const result = MACAddress.create('AA:BB:CC:DD:EE');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for too many segments', () => {
        const result = MACAddress.create('AA:BB:CC:DD:EE:FF:00');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for invalid hex characters', () => {
        const result = MACAddress.create('GG:BB:CC:DD:EE:FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for mixed separators', () => {
        const result = MACAddress.create('AA:BB-CC:DD-EE:FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for segments with too few characters', () => {
        const result = MACAddress.create('A:BB:CC:DD:EE:FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for segments with too many characters', () => {
        const result = MACAddress.create('AAA:BB:CC:DD:EE:FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for missing separators', () => {
        const result = MACAddress.create('AABBCCDDEEFF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for dots as separators', () => {
        const result = MACAddress.create('AA.BB.CC.DD.EE.FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for spaces as separators', () => {
        const result = MACAddress.create('AA BB CC DD EE FF');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });

      it('should fail for segments with special characters', () => {
        const result = MACAddress.create('AA:BB:CC:DD:EE:F@');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });
    });

    describe('when invalid input', () => {
      it('should fail for null', () => {
        const result = MACAddress.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('MAC address');
      });

      it('should fail for undefined', () => {
        const result = MACAddress.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('MAC address');
      });

      it('should fail for non-string value', () => {
        const result = MACAddress.create(123 as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('string');
      });

      it('should fail for empty string', () => {
        const result = MACAddress.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = MACAddress.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for random string', () => {
        const result = MACAddress.create('not-a-mac-address');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MAC address format');
      });
    });
  });

  describe('static isValid', () => {
    it('should return true for valid colon-separated MAC', () => {
      expect(MACAddress.isValid('AA:BB:CC:DD:EE:FF')).toBe(true);
      expect(MACAddress.isValid('00:00:00:00:00:00')).toBe(true);
      expect(MACAddress.isValid('FF:FF:FF:FF:FF:FF')).toBe(true);
      expect(MACAddress.isValid('12:34:56:78:9A:BC')).toBe(true);
    });

    it('should return true for valid hyphen-separated MAC', () => {
      expect(MACAddress.isValid('AA-BB-CC-DD-EE-FF')).toBe(true);
      expect(MACAddress.isValid('00-00-00-00-00-00')).toBe(true);
      expect(MACAddress.isValid('FF-FF-FF-FF-FF-FF')).toBe(true);
    });

    it('should return true for lowercase MAC addresses', () => {
      expect(MACAddress.isValid('aa:bb:cc:dd:ee:ff')).toBe(true);
      expect(MACAddress.isValid('aa-bb-cc-dd-ee-ff')).toBe(true);
    });

    it('should return false for invalid MAC addresses', () => {
      expect(MACAddress.isValid('GG:BB:CC:DD:EE:FF')).toBe(false);
      expect(MACAddress.isValid('AA:BB:CC:DD:EE')).toBe(false);
      expect(MACAddress.isValid('AA:BB-CC:DD-EE:FF')).toBe(false);
      expect(MACAddress.isValid('AABBCCDDEEFF')).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should return normalized MAC address', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.normalize()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return normalized value for hyphen input', () => {
      const mac = MACAddress.create('AA-BB-CC-DD-EE-FF').value;

      expect(mac.normalize()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return normalized value for lowercase input', () => {
      const mac = MACAddress.create('aa:bb:cc:dd:ee:ff').value;

      expect(mac.normalize()).toBe('AA:BB:CC:DD:EE:FF');
    });
  });

  describe('toHyphenFormat', () => {
    it('should convert to hyphen-separated format', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.toHyphenFormat()).toBe('AA-BB-CC-DD-EE-FF');
    });

    it('should convert hyphen input to hyphen format', () => {
      const mac = MACAddress.create('AA-BB-CC-DD-EE-FF').value;

      expect(mac.toHyphenFormat()).toBe('AA-BB-CC-DD-EE-FF');
    });

    it('should convert lowercase to uppercase hyphen format', () => {
      const mac = MACAddress.create('aa:bb:cc:dd:ee:ff').value;

      expect(mac.toHyphenFormat()).toBe('AA-BB-CC-DD-EE-FF');
    });
  });

  describe('toCompactFormat', () => {
    it('should return MAC without separators', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.toCompactFormat()).toBe('AABBCCDDEEFF');
    });

    it('should return compact format for hyphen input', () => {
      const mac = MACAddress.create('AA-BB-CC-DD-EE-FF').value;

      expect(mac.toCompactFormat()).toBe('AABBCCDDEEFF');
    });

    it('should return uppercase compact format for lowercase input', () => {
      const mac = MACAddress.create('aa:bb:cc:dd:ee:ff').value;

      expect(mac.toCompactFormat()).toBe('AABBCCDDEEFF');
    });
  });

  describe('equals', () => {
    it('should return true for same MAC addresses', () => {
      const mac1 = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const mac2 = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac1.equals(mac2)).toBe(true);
    });

    it('should return true for MAC created with different formats but same value', () => {
      const mac1 = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const mac2 = MACAddress.create('AA-BB-CC-DD-EE-FF').value;

      expect(mac1.equals(mac2)).toBe(true);
    });

    it('should return true for MAC created with different cases but same value', () => {
      const mac1 = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const mac2 = MACAddress.create('aa:bb:cc:dd:ee:ff').value;

      expect(mac1.equals(mac2)).toBe(true);
    });

    it('should return false for different MAC addresses', () => {
      const mac1 = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const mac2 = MACAddress.create('00:11:22:33:44:55').value;

      expect(mac1.equals(mac2)).toBe(false);
    });

    it('should return false for null', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the normalized MAC address', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(mac.toString()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return normalized value for hyphen input', () => {
      const mac = MACAddress.create('AA-BB-CC-DD-EE-FF').value;

      expect(mac.toString()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return uppercase for lowercase input', () => {
      const mac = MACAddress.create('aa:bb:cc:dd:ee:ff').value;

      expect(mac.toString()).toBe('AA:BB:CC:DD:EE:FF');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        mac.props.value = '00:11:22:33:44:55';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      mac.props = { value: '00:11:22:33:44:55' };
    });
  });
});
