import { ManagementProtocol } from '../../../src/domain';

describe('ManagementProtocol', () => {
  describe('create', () => {
    describe('when valid protocol', () => {
      const validProtocols = [
        'SNMP',
        'SSH',
        'TELNET',
        'HTTP',
        'HTTPS',
        'ICMP',
        'OTHER'
      ];

      validProtocols.forEach((protocol) => {
        it(`should create ManagementProtocol with ${protocol}`, () => {
          const result = ManagementProtocol.create(protocol);

          expect(result.isSuccess).toBe(true);
          expect(result.value.value).toBe(protocol);
        });
      });

      it('should normalize to uppercase', () => {
        const result = ManagementProtocol.create('snmp');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SNMP');
      });

      it('should trim whitespace', () => {
        const result = ManagementProtocol.create('  SSH  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SSH');
      });

      it('should handle mixed case', () => {
        const result = ManagementProtocol.create('HtTpS');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('HTTPS');
      });
    });

    describe('when invalid protocol', () => {
      it('should fail for null', () => {
        const result = ManagementProtocol.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('management protocol');
      });

      it('should fail for undefined', () => {
        const result = ManagementProtocol.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('management protocol');
      });

      it('should fail for empty string', () => {
        const result = ManagementProtocol.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = ManagementProtocol.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid protocol value', () => {
        const result = ManagementProtocol.create('INVALID_PROTOCOL');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid management protocol');
      });
    });
  });

  describe('convenience factory methods', () => {
    it('should create SNMP with createSnmp', () => {
      const result = ManagementProtocol.createSnmp();

      expect(result.toString()).toBe('SNMP');
      expect(result.isSnmp()).toBe(true);
    });

    it('should create SSH with createSsh', () => {
      const result = ManagementProtocol.createSsh();

      expect(result.toString()).toBe('SSH');
      expect(result.isSsh()).toBe(true);
    });

    it('should create TELNET with createTelnet', () => {
      const result = ManagementProtocol.createTelnet();

      expect(result.toString()).toBe('TELNET');
      expect(result.isTelnet()).toBe(true);
    });

    it('should create HTTP with createHttp', () => {
      const result = ManagementProtocol.createHttp();

      expect(result.toString()).toBe('HTTP');
      expect(result.isHttp()).toBe(true);
    });

    it('should create HTTPS with createHttps', () => {
      const result = ManagementProtocol.createHttps();

      expect(result.toString()).toBe('HTTPS');
      expect(result.isHttps()).toBe(true);
    });

    it('should create ICMP with createIcmp', () => {
      const result = ManagementProtocol.createIcmp();

      expect(result.toString()).toBe('ICMP');
      expect(result.isIcmp()).toBe(true);
    });

    it('should create OTHER with createOther', () => {
      const result = ManagementProtocol.createOther();

      expect(result.toString()).toBe('OTHER');
      expect(result.isOther()).toBe(true);
    });
  });

  describe('type checking methods', () => {
    it('should correctly identify SNMP', () => {
      const protocol = ManagementProtocol.createSnmp();

      expect(protocol.isSnmp()).toBe(true);
      expect(protocol.isSsh()).toBe(false);
      expect(protocol.isTelnet()).toBe(false);
      expect(protocol.isHttp()).toBe(false);
      expect(protocol.isHttps()).toBe(false);
      expect(protocol.isIcmp()).toBe(false);
      expect(protocol.isOther()).toBe(false);
    });

    it('should correctly identify SSH', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.isSsh()).toBe(true);
      expect(protocol.isSnmp()).toBe(false);
    });

    it('should correctly identify TELNET', () => {
      const protocol = ManagementProtocol.createTelnet();

      expect(protocol.isTelnet()).toBe(true);
      expect(protocol.isSsh()).toBe(false);
    });

    it('should correctly identify HTTP', () => {
      const protocol = ManagementProtocol.createHttp();

      expect(protocol.isHttp()).toBe(true);
      expect(protocol.isHttps()).toBe(false);
    });

    it('should correctly identify HTTPS', () => {
      const protocol = ManagementProtocol.createHttps();

      expect(protocol.isHttps()).toBe(true);
      expect(protocol.isHttp()).toBe(false);
    });

    it('should correctly identify ICMP', () => {
      const protocol = ManagementProtocol.createIcmp();

      expect(protocol.isIcmp()).toBe(true);
      expect(protocol.isSnmp()).toBe(false);
    });

    it('should correctly identify OTHER', () => {
      const protocol = ManagementProtocol.createOther();

      expect(protocol.isOther()).toBe(true);
      expect(protocol.isSnmp()).toBe(false);
    });
  });

  describe('isSecure', () => {
    it('should return true for SSH', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.isSecure()).toBe(true);
    });

    it('should return true for HTTPS', () => {
      const protocol = ManagementProtocol.createHttps();

      expect(protocol.isSecure()).toBe(true);
    });

    it('should return false for SNMP', () => {
      const protocol = ManagementProtocol.createSnmp();

      expect(protocol.isSecure()).toBe(false);
    });

    it('should return false for TELNET', () => {
      const protocol = ManagementProtocol.createTelnet();

      expect(protocol.isSecure()).toBe(false);
    });

    it('should return false for HTTP', () => {
      const protocol = ManagementProtocol.createHttp();

      expect(protocol.isSecure()).toBe(false);
    });

    it('should return false for ICMP', () => {
      const protocol = ManagementProtocol.createIcmp();

      expect(protocol.isSecure()).toBe(false);
    });

    it('should return false for OTHER', () => {
      const protocol = ManagementProtocol.createOther();

      expect(protocol.isSecure()).toBe(false);
    });
  });

  describe('isDeprecated', () => {
    it('should return true for TELNET', () => {
      const protocol = ManagementProtocol.createTelnet();

      expect(protocol.isDeprecated()).toBe(true);
    });

    it('should return false for SSH', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.isDeprecated()).toBe(false);
    });

    it('should return false for SNMP', () => {
      const protocol = ManagementProtocol.createSnmp();

      expect(protocol.isDeprecated()).toBe(false);
    });

    it('should return false for HTTP', () => {
      const protocol = ManagementProtocol.createHttp();

      expect(protocol.isDeprecated()).toBe(false);
    });

    it('should return false for HTTPS', () => {
      const protocol = ManagementProtocol.createHttps();

      expect(protocol.isDeprecated()).toBe(false);
    });

    it('should return false for ICMP', () => {
      const protocol = ManagementProtocol.createIcmp();

      expect(protocol.isDeprecated()).toBe(false);
    });

    it('should return false for OTHER', () => {
      const protocol = ManagementProtocol.createOther();

      expect(protocol.isDeprecated()).toBe(false);
    });
  });

  describe('getDefaultPort', () => {
    it('should return 161 for SNMP', () => {
      const protocol = ManagementProtocol.createSnmp();

      expect(protocol.getDefaultPort()).toBe(161);
    });

    it('should return 22 for SSH', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.getDefaultPort()).toBe(22);
    });

    it('should return 23 for TELNET', () => {
      const protocol = ManagementProtocol.createTelnet();

      expect(protocol.getDefaultPort()).toBe(23);
    });

    it('should return 80 for HTTP', () => {
      const protocol = ManagementProtocol.createHttp();

      expect(protocol.getDefaultPort()).toBe(80);
    });

    it('should return 443 for HTTPS', () => {
      const protocol = ManagementProtocol.createHttps();

      expect(protocol.getDefaultPort()).toBe(443);
    });

    it('should return 0 for ICMP (no port)', () => {
      const protocol = ManagementProtocol.createIcmp();

      expect(protocol.getDefaultPort()).toBe(0);
    });

    it('should return 0 for OTHER (unknown)', () => {
      const protocol = ManagementProtocol.createOther();

      expect(protocol.getDefaultPort()).toBe(0);
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display name for SNMP', () => {
      const protocol = ManagementProtocol.createSnmp();

      expect(protocol.getDisplayName()).toBe('SNMP');
    });

    it('should return correct display name for SSH', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.getDisplayName()).toBe('SSH');
    });

    it('should return correct display name for TELNET', () => {
      const protocol = ManagementProtocol.createTelnet();

      expect(protocol.getDisplayName()).toBe('Telnet');
    });

    it('should return correct display name for HTTP', () => {
      const protocol = ManagementProtocol.createHttp();

      expect(protocol.getDisplayName()).toBe('HTTP');
    });

    it('should return correct display name for HTTPS', () => {
      const protocol = ManagementProtocol.createHttps();

      expect(protocol.getDisplayName()).toBe('HTTPS');
    });

    it('should return correct display name for ICMP', () => {
      const protocol = ManagementProtocol.createIcmp();

      expect(protocol.getDisplayName()).toBe('ICMP');
    });

    it('should return correct display name for OTHER', () => {
      const protocol = ManagementProtocol.createOther();

      expect(protocol.getDisplayName()).toBe('Other');
    });
  });

  describe('equals', () => {
    it('should return true for same protocol values', () => {
      const protocol1 = ManagementProtocol.createSsh();
      const protocol2 = ManagementProtocol.createSsh();

      expect(protocol1.equals(protocol2)).toBe(true);
    });

    it('should return true for protocols created with different methods but same value', () => {
      const protocol1 = ManagementProtocol.createSsh();
      const protocol2 = ManagementProtocol.create('SSH');

      expect(protocol1.equals(protocol2.value)).toBe(true);
    });

    it('should return false for different protocol values', () => {
      const protocol1 = ManagementProtocol.createSsh();
      const protocol2 = ManagementProtocol.createTelnet();

      expect(protocol1.equals(protocol2)).toBe(false);
    });

    it('should return false for null', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(protocol.toString()).toBe('SSH');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const protocol = ManagementProtocol.createSsh();

      expect(() => {
        // @ts-expect-error - Testing immutability
        protocol.props = 'TELNET';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const protocol = ManagementProtocol.createSsh();

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        protocol.props = { value: 'TELNET' };
      }).toThrow();
    });
  });
});
