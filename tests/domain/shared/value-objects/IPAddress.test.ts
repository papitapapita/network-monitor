// Source: src/domain/device-inventory/value-objects/IPAddress.ts

import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';

describe('IPAddress', () => {
  describe('create', () => {
    describe('when valid IPv4 address', () => {
      it('should create IPAddress with standard IPv4', () => {
        const result = IPAddress.create('192.168.1.1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('192.168.1.1');
        expect(result.value.isIPv4()).toBe(true);
        expect(result.value.isIPv6()).toBe(false);
      });

      it('should create IPAddress with localhost IPv4', () => {
        const result = IPAddress.create('127.0.0.1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('127.0.0.1');
        expect(result.value.isIPv4()).toBe(true);
      });

      it('should create IPAddress with all zeros IPv4', () => {
        const result = IPAddress.create('0.0.0.0');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv4()).toBe(true);
      });

      it('should create IPAddress with max values IPv4', () => {
        const result = IPAddress.create('255.255.255.255');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv4()).toBe(true);
      });

      it('should create IPAddress with private network IPv4', () => {
        const result = IPAddress.create('10.0.0.1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv4()).toBe(true);
      });

      it('should trim whitespace from IPv4', () => {
        const result = IPAddress.create('  192.168.1.1  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('192.168.1.1');
      });
    });

    describe('when invalid IPv4 address', () => {
      it('should fail for octet exceeding 255', () => {
        const result = IPAddress.create('999.168.1.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with missing octets', () => {
        const result = IPAddress.create('192.168.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with too many octets', () => {
        const result = IPAddress.create('192.168.1.1.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with invalid characters', () => {
        const result = IPAddress.create('192.168.a.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with negative numbers', () => {
        const result = IPAddress.create('192.168.-1.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with leading zeros in octets', () => {
        const result = IPAddress.create('192.168.01.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv4 with spaces between octets', () => {
        const result = IPAddress.create('192.168. 1.1');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });
    });

    describe('when valid IPv6 address', () => {
      it('should create IPAddress with full IPv6 notation', () => {
        const result = IPAddress.create(
          '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
        expect(result.value.isIPv4()).toBe(false);
      });

      it('should create IPAddress with compressed IPv6 notation', () => {
        const result = IPAddress.create('2001:db8::8a2e:370:7334');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
      });

      it('should create IPAddress with IPv6 localhost', () => {
        const result = IPAddress.create('::1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
      });

      it('should create IPAddress with IPv6 all zeros', () => {
        const result = IPAddress.create('::');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
      });

      it('should create IPAddress with fe80 link-local IPv6', () => {
        const result = IPAddress.create('fe80::1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
      });

      it('should create IPAddress with full form IPv6', () => {
        const result = IPAddress.create(
          '2001:0db8:0000:0000:0000:0000:0000:0001'
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.isIPv6()).toBe(true);
      });

      it('should trim whitespace from IPv6', () => {
        const result = IPAddress.create('  2001:db8::1  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('2001:db8::1');
      });

      it('should normalize uppercase IPv6 to lowercase', () => {
        const result = IPAddress.create('2001:0DB8::1');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('2001:0db8::1');
      });
    });

    describe('when invalid IPv6 address', () => {
      it('should fail for IPv6 with too many colons', () => {
        const result = IPAddress.create('2001:::85a3:::7334');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv6 with invalid hexadecimal characters', () => {
        const result = IPAddress.create('2001:0db8:85g3::7334');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv6 with too many segments', () => {
        const result = IPAddress.create(
          '2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra'
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for IPv6 with segment exceeding 4 hex digits', () => {
        const result = IPAddress.create(
          '2001:0db8:85a3a:0000:0000:8a2e:0370:7334'
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });
    });

    describe('when invalid input', () => {
      it('should fail for null', () => {
        const result = IPAddress.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ip address');
      });

      it('should fail for undefined', () => {
        const result = IPAddress.create(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ip address');
      });

      it('should fail for non-string value', () => {
        const result = IPAddress.create(123 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('string');
      });

      it('should fail for empty string', () => {
        const result = IPAddress.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = IPAddress.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for random string', () => {
        const result = IPAddress.create('not-an-ip-address');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });

      it('should fail for hostname instead of IP', () => {
        const result = IPAddress.create('example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid IP address format');
      });
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute an IPv4 address without validation', () => {
      const ip = IPAddress.reconstitute('10.0.0.1');

      expect(ip.value).toBe('10.0.0.1');
      expect(ip.isIPv4()).toBe(true);
      expect(ip.isIPv6()).toBe(false);
    });

    it('should reconstitute an IPv6 address without validation', () => {
      const ip = IPAddress.reconstitute('2001:db8::1');

      expect(ip.value).toBe('2001:db8::1');
      expect(ip.isIPv6()).toBe(true);
      expect(ip.isIPv4()).toBe(false);
    });

    it('should infer version 6 when the address contains a colon', () => {
      const ip = IPAddress.reconstitute('::1');

      expect(ip.isIPv6()).toBe(true);
    });

    it('should infer version 4 when the address contains no colon', () => {
      const ip = IPAddress.reconstitute('192.168.1.1');

      expect(ip.isIPv4()).toBe(true);
    });
  });

  describe('isIPv4', () => {
    it('should return true for IPv4 address', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.isIPv4()).toBe(true);
    });

    it('should return false for IPv6 address', () => {
      const ip = IPAddress.create('2001:db8::1').value;

      expect(ip.isIPv4()).toBe(false);
    });
  });

  describe('isIPv6', () => {
    it('should return true for IPv6 address', () => {
      const ip = IPAddress.create('2001:db8::1').value;

      expect(ip.isIPv6()).toBe(true);
    });

    it('should return false for IPv4 address', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.isIPv6()).toBe(false);
    });
  });

  describe('static isValidIPv4', () => {
    it('should return true for valid IPv4', () => {
      expect(IPAddress.isValidIPv4('192.168.1.1')).toBe(true);
      expect(IPAddress.isValidIPv4('0.0.0.0')).toBe(true);
      expect(IPAddress.isValidIPv4('255.255.255.255')).toBe(true);
      expect(IPAddress.isValidIPv4('127.0.0.1')).toBe(true);
    });

    it('should return false for invalid IPv4', () => {
      expect(IPAddress.isValidIPv4('256.1.1.1')).toBe(false);
      expect(IPAddress.isValidIPv4('192.168.1')).toBe(false);
      expect(IPAddress.isValidIPv4('192.168.1.1.1')).toBe(false);
      expect(IPAddress.isValidIPv4('192.168.a.1')).toBe(false);
    });

    it('should return false for IPv6 addresses', () => {
      expect(IPAddress.isValidIPv4('2001:db8::1')).toBe(false);
    });
  });

  describe('static isValidIPv6', () => {
    it('should return true for valid IPv6', () => {
      expect(
        IPAddress.isValidIPv6(
          '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        )
      ).toBe(true);
      expect(IPAddress.isValidIPv6('2001:db8::8a2e:370:7334')).toBe(
        true
      );
      expect(IPAddress.isValidIPv6('::1')).toBe(true);
      expect(IPAddress.isValidIPv6('::')).toBe(true);
    });

    it('should return false for invalid IPv6', () => {
      expect(IPAddress.isValidIPv6('2001:::1')).toBe(false);
      expect(IPAddress.isValidIPv6('gggg::1')).toBe(false);
      expect(IPAddress.isValidIPv6('2001:db8::1::2')).toBe(false);
    });

    it('should return false for IPv4 addresses', () => {
      expect(IPAddress.isValidIPv6('192.168.1.1')).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same IPv4 addresses', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('192.168.1.1').value;

      expect(ip1.equals(ip2)).toBe(true);
    });

    it('should return true for same IPv6 addresses', () => {
      const ip1 = IPAddress.create('2001:db8::1').value;
      const ip2 = IPAddress.create('2001:db8::1').value;

      expect(ip1.equals(ip2)).toBe(true);
    });

    it('should return false for different IPv4 addresses', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('192.168.1.2').value;

      expect(ip1.equals(ip2)).toBe(false);
    });

    it('should return false for different IPv6 addresses', () => {
      const ip1 = IPAddress.create('2001:db8::1').value;
      const ip2 = IPAddress.create('2001:db8::2').value;

      expect(ip1.equals(ip2)).toBe(false);
    });

    it('should return false for IPv4 vs IPv6', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('2001:db8::1').value;

      expect(ip1.equals(ip2)).toBe(false);
    });

    it('should return false for null', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.equals(null as unknown as IPAddress)).toBe(false);
    });

    it('should return false for undefined', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.equals(undefined as unknown as IPAddress)).toBe(
        false
      );
    });
  });

  describe('toString', () => {
    it('should return the IPv4 address as string', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      expect(ip.toString()).toBe('192.168.1.1');
    });

    it('should return the IPv6 address as string', () => {
      const ip = IPAddress.create('2001:db8::1').value;

      expect(ip.toString()).toBe('2001:db8::1');
    });

    it('should return normalized lowercase for uppercase IPv6 input', () => {
      const ip = IPAddress.create('2001:0DB8::1').value;

      expect(ip.toString()).toBe('2001:0db8::1');
    });
  });

  describe('immutability', () => {
    it('should return a consistent value after creation', () => {
      const ip = IPAddress.create('192.168.1.1').value;
      const originalValue = ip.value;

      // Access value getter multiple times to confirm it never changes
      expect(ip.value).toBe(originalValue);
      expect(ip.value).toBe('192.168.1.1');
    });

    it('should be frozen and not allow mutation of internal props', () => {
      const ip = IPAddress.create('192.168.1.1').value;

      // The object and its props are frozen via Object.freeze in the constructor
      expect(Object.isFrozen(ip)).toBe(true);
    });
  });
});
