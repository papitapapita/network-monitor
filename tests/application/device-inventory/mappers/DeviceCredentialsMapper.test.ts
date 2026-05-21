// Source: src/application/device-inventory/mappers/DeviceCredentialsMapper.ts

import { DeviceCredentialsMapper } from 'application/device-inventory/mappers/DeviceCredentialsMapper';
import { DeviceCredentials } from 'application/device-inventory/interfaces';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440010';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeCredentials(
  overrides: Partial<DeviceCredentials> = {}
): DeviceCredentials {
  return {
    snmpVersion: 2,
    snmpCommunity: 'public',
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    snmpPort: 161,
    httpUsername: null,
    httpPassword: null,
    httpPort: 80,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('DeviceCredentialsMapper', () => {
  // ==========================================================================
  describe('toDTO()', () => {
    // ------------------------------------------------------------------------
    describe('field pass-through', () => {
      it('should map deviceId to the provided string', () => {
        const dto = DeviceCredentialsMapper.toDTO(DEVICE_UUID, makeCredentials());

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should map snmpVersion from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3 })
        );

        expect(dto.snmpVersion).toBe(3);
      });

      it('should map snmpPort from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpPort: 1161 })
        );

        expect(dto.snmpPort).toBe(1161);
      });

      it('should map httpPort from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpPort: 8080 })
        );

        expect(dto.httpPort).toBe(8080);
      });

      it('should map snmpV3AuthUser from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3, snmpV3AuthUser: 'adminUser' })
        );

        expect(dto.snmpV3AuthUser).toBe('adminUser');
      });

      it('should map snmpV3AuthProto from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3, snmpV3AuthProto: 'SHA' })
        );

        expect(dto.snmpV3AuthProto).toBe('SHA');
      });

      it('should map snmpV3PrivProto from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3, snmpV3PrivProto: 'AES' })
        );

        expect(dto.snmpV3PrivProto).toBe('AES');
      });

      it('should map httpUsername from credentials', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpUsername: 'ubnt' })
        );

        expect(dto.httpUsername).toBe('ubnt');
      });
    });

    // ------------------------------------------------------------------------
    describe('secret masking — snmpCommunity', () => {
      it('should mask snmpCommunity as "***" when a community string is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpCommunity: 'public' })
        );

        expect(dto.snmpCommunity).toBe('***');
      });

      it('should set snmpCommunity to null when no community string is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpCommunity: null })
        );

        expect(dto.snmpCommunity).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('secret masking — snmpV3AuthKey', () => {
      it('should mask snmpV3AuthKey as "***" when an auth key is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3, snmpV3AuthKey: 'secretkey' })
        );

        expect(dto.snmpV3AuthKey).toBe('***');
      });

      it('should set snmpV3AuthKey to null when no auth key is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpV3AuthKey: null })
        );

        expect(dto.snmpV3AuthKey).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('secret masking — snmpV3PrivKey', () => {
      it('should mask snmpV3PrivKey as "***" when a privacy key is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 3, snmpV3PrivKey: 'privkey' })
        );

        expect(dto.snmpV3PrivKey).toBe('***');
      });

      it('should set snmpV3PrivKey to null when no privacy key is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpV3PrivKey: null })
        );

        expect(dto.snmpV3PrivKey).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('secret masking — httpPassword', () => {
      it('should mask httpPassword as "***" when a password is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpUsername: 'ubnt', httpPassword: 'secret' })
        );

        expect(dto.httpPassword).toBe('***');
      });

      it('should set httpPassword to null when no password is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpPassword: null })
        );

        expect(dto.httpPassword).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('hasSnmpCredentials — v1/v2 logic', () => {
      it('should be true for v1 when snmpCommunity is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 1, snmpCommunity: 'public' })
        );

        expect(dto.hasSnmpCredentials).toBe(true);
      });

      it('should be true for v2 when snmpCommunity is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 2, snmpCommunity: 'public' })
        );

        expect(dto.hasSnmpCredentials).toBe(true);
      });

      it('should be false for v1 when snmpCommunity is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 1, snmpCommunity: null })
        );

        expect(dto.hasSnmpCredentials).toBe(false);
      });

      it('should be false for v2 when snmpCommunity is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ snmpVersion: 2, snmpCommunity: null })
        );

        expect(dto.hasSnmpCredentials).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    describe('hasSnmpCredentials — v3 logic', () => {
      it('should be true for v3 when both snmpV3AuthUser and snmpV3AuthKey are set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({
            snmpVersion: 3,
            snmpCommunity: null,
            snmpV3AuthUser: 'adminUser',
            snmpV3AuthKey: 'authkey'
          })
        );

        expect(dto.hasSnmpCredentials).toBe(true);
      });

      it('should be false for v3 when snmpV3AuthUser is null even if snmpV3AuthKey is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({
            snmpVersion: 3,
            snmpCommunity: null,
            snmpV3AuthUser: null,
            snmpV3AuthKey: 'authkey'
          })
        );

        expect(dto.hasSnmpCredentials).toBe(false);
      });

      it('should be false for v3 when snmpV3AuthKey is null even if snmpV3AuthUser is set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({
            snmpVersion: 3,
            snmpCommunity: null,
            snmpV3AuthUser: 'adminUser',
            snmpV3AuthKey: null
          })
        );

        expect(dto.hasSnmpCredentials).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    describe('hasHttpCredentials', () => {
      it('should be true when both httpUsername and httpPassword are set', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpUsername: 'ubnt', httpPassword: 'secret' })
        );

        expect(dto.hasHttpCredentials).toBe(true);
      });

      it('should be false when httpUsername is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpUsername: null, httpPassword: 'secret' })
        );

        expect(dto.hasHttpCredentials).toBe(false);
      });

      it('should be false when httpPassword is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({ httpUsername: 'ubnt', httpPassword: null })
        );

        expect(dto.hasHttpCredentials).toBe(false);
      });
    });

    // ------------------------------------------------------------------------
    describe('purity', () => {
      it('should produce identical output on repeated calls with the same input', () => {
        const credentials = makeCredentials({
          snmpVersion: 2,
          snmpCommunity: 'public',
          httpUsername: 'ubnt',
          httpPassword: 'secret'
        });

        expect(DeviceCredentialsMapper.toDTO(DEVICE_UUID, credentials)).toEqual(
          DeviceCredentialsMapper.toDTO(DEVICE_UUID, credentials)
        );
      });
    });
  });

  // ==========================================================================
  describe('extractCreateData()', () => {
    // ------------------------------------------------------------------------
    describe('required fields', () => {
      it('should pass snmpVersion through as-is', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 1
        });

        expect(result.snmpVersion).toBe(1);
      });
    });

    // ------------------------------------------------------------------------
    describe('optional fields — absent (defaults)', () => {
      it('should default snmpCommunity to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2
        });

        expect(result.snmpCommunity).toBeNull();
      });

      it('should default snmpV3AuthUser to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3
        });

        expect(result.snmpV3AuthUser).toBeNull();
      });

      it('should default snmpV3AuthProto to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3
        });

        expect(result.snmpV3AuthProto).toBeNull();
      });

      it('should default snmpV3AuthKey to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3
        });

        expect(result.snmpV3AuthKey).toBeNull();
      });

      it('should default snmpV3PrivProto to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3
        });

        expect(result.snmpV3PrivProto).toBeNull();
      });

      it('should default snmpV3PrivKey to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3
        });

        expect(result.snmpV3PrivKey).toBeNull();
      });

      it('should default snmpPort to 161 when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2
        });

        expect(result.snmpPort).toBe(161);
      });

      it('should default httpUsername to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2
        });

        expect(result.httpUsername).toBeNull();
      });

      it('should default httpPassword to null when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2
        });

        expect(result.httpPassword).toBeNull();
      });

      it('should default httpPort to 80 when absent', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2
        });

        expect(result.httpPort).toBe(80);
      });
    });

    // ------------------------------------------------------------------------
    describe('optional fields — provided values override defaults', () => {
      it('should use the provided snmpPort instead of the default 161', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          snmpPort: 162
        });

        expect(result.snmpPort).toBe(162);
      });

      it('should use the provided httpPort instead of the default 80', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          httpPort: 443
        });

        expect(result.httpPort).toBe(443);
      });

      it('should pass through snmpCommunity when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          snmpCommunity: 'private'
        });

        expect(result.snmpCommunity).toBe('private');
      });

      it('should pass through snmpV3AuthUser when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3AuthUser: 'adminUser'
        });

        expect(result.snmpV3AuthUser).toBe('adminUser');
      });

      it('should pass through snmpV3AuthProto when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3AuthProto: 'MD5'
        });

        expect(result.snmpV3AuthProto).toBe('MD5');
      });

      it('should pass through snmpV3AuthKey when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3AuthKey: 'authsecret'
        });

        expect(result.snmpV3AuthKey).toBe('authsecret');
      });

      it('should pass through snmpV3PrivProto when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3PrivProto: 'DES'
        });

        expect(result.snmpV3PrivProto).toBe('DES');
      });

      it('should pass through snmpV3PrivKey when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3PrivKey: 'privsecret'
        });

        expect(result.snmpV3PrivKey).toBe('privsecret');
      });

      it('should pass through httpUsername when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          httpUsername: 'ubnt'
        });

        expect(result.httpUsername).toBe('ubnt');
      });

      it('should pass through httpPassword when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          httpPassword: 'topsecret'
        });

        expect(result.httpPassword).toBe('topsecret');
      });
    });

    // ------------------------------------------------------------------------
    describe('optional fields — explicit null values', () => {
      it('should treat explicit null snmpCommunity as null', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          snmpCommunity: null
        });

        expect(result.snmpCommunity).toBeNull();
      });

      it('should treat explicit null snmpV3AuthUser as null', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 3,
          snmpV3AuthUser: null
        });

        expect(result.snmpV3AuthUser).toBeNull();
      });

      it('should treat explicit null httpPassword as null', () => {
        const result = DeviceCredentialsMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          snmpVersion: 2,
          httpPassword: null
        });

        expect(result.httpPassword).toBeNull();
      });
    });
  });

  // ==========================================================================
  describe('mapper compliance', () => {
    it('should expose toDTO as a static method', () => {
      expect(typeof DeviceCredentialsMapper.toDTO).toBe('function');
    });

    it('should expose extractCreateData as a static method', () => {
      expect(typeof DeviceCredentialsMapper.extractCreateData).toBe('function');
    });
  });
});
