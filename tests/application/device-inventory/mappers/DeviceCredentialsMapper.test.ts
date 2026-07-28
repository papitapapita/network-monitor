// Source: src/application/device-inventory/mappers/DeviceCredentialsMapper.ts

import { DeviceCredentialsMapper } from 'application/device-inventory/mappers/DeviceCredentialsMapper';
import { DeviceCredentials } from 'application/device-inventory/interfaces';
import { SetDeviceCredentialsRequestDTO } from 'application/device-inventory/dtos';

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

function makeRequest(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return {
    deviceId: DEVICE_UUID,
    httpUsername: 'ubnt',
    httpPassword: 'topsecret',
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
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials()
        );

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
          makeCredentials({
            snmpVersion: 3,
            snmpV3AuthUser: 'adminUser'
          })
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
          makeCredentials({
            snmpVersion: 3,
            snmpV3AuthKey: 'secretkey'
          })
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
          makeCredentials({
            snmpVersion: 3,
            snmpV3PrivKey: 'privkey'
          })
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
          makeCredentials({
            httpUsername: 'ubnt',
            httpPassword: 'secret'
          })
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
          makeCredentials({
            httpUsername: 'ubnt',
            httpPassword: 'secret'
          })
        );

        expect(dto.hasHttpCredentials).toBe(true);
      });

      it('should be false when httpUsername is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({
            httpUsername: null,
            httpPassword: 'secret'
          })
        );

        expect(dto.hasHttpCredentials).toBe(false);
      });

      it('should be false when httpPassword is null', () => {
        const dto = DeviceCredentialsMapper.toDTO(
          DEVICE_UUID,
          makeCredentials({
            httpUsername: 'ubnt',
            httpPassword: null
          })
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

        expect(
          DeviceCredentialsMapper.toDTO(DEVICE_UUID, credentials)
        ).toEqual(
          DeviceCredentialsMapper.toDTO(DEVICE_UUID, credentials)
        );
      });
    });
  });

  // ==========================================================================
  describe('extractCreateData()', () => {
    // ------------------------------------------------------------------------
    describe('HTTP fields — always replaced', () => {
      it('should pass httpUsername through as-is', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ httpUsername: 'operator' })
        );

        expect(result.httpUsername).toBe('operator');
      });

      it('should pass httpPassword through as-is', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ httpPassword: 'pw-value' })
        );

        expect(result.httpPassword).toBe('pw-value');
      });

      it('should default httpPort to 443 when absent', () => {
        const result =
          DeviceCredentialsMapper.extractCreateData(makeRequest());

        expect(result.httpPort).toBe(443);
      });

      it('should use the provided httpPort instead of the default 443', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ httpPort: 8080 })
        );

        expect(result.httpPort).toBe(8080);
      });

      it('should replace stored HTTP values rather than keeping them', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({
            httpUsername: 'new-user',
            httpPassword: 'new-pw'
          }),
          makeCredentials({
            httpUsername: 'old-user',
            httpPassword: 'old-pw',
            httpPort: 8443
          })
        );

        expect(result.httpUsername).toBe('new-user');
        expect(result.httpPassword).toBe('new-pw');
        expect(result.httpPort).toBe(443);
      });
    });

    // ------------------------------------------------------------------------
    describe('SNMP fields — absent with nothing stored (defaults)', () => {
      it('should default snmpVersion to 1', () => {
        const result =
          DeviceCredentialsMapper.extractCreateData(makeRequest());

        expect(result.snmpVersion).toBe(1);
      });

      it('should pass snmpVersion through as-is when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpVersion: 3 })
        );

        expect(result.snmpVersion).toBe(3);
      });

      it('should default snmpCommunity to null', () => {
        const result =
          DeviceCredentialsMapper.extractCreateData(makeRequest());

        expect(result.snmpCommunity).toBeNull();
      });

      it('should default every SNMPv3 field to null', () => {
        const result =
          DeviceCredentialsMapper.extractCreateData(makeRequest());

        expect(result.snmpV3AuthUser).toBeNull();
        expect(result.snmpV3AuthProto).toBeNull();
        expect(result.snmpV3AuthKey).toBeNull();
        expect(result.snmpV3PrivProto).toBeNull();
        expect(result.snmpV3PrivKey).toBeNull();
      });

      it('should default snmpPort to 161', () => {
        const result =
          DeviceCredentialsMapper.extractCreateData(makeRequest());

        expect(result.snmpPort).toBe(161);
      });
    });

    // ------------------------------------------------------------------------
    describe('SNMP fields — provided values override defaults', () => {
      it('should use the provided snmpPort instead of the default 161', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpVersion: 2, snmpPort: 162 })
        );

        expect(result.snmpPort).toBe(162);
      });

      it('should pass through snmpCommunity when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpVersion: 2, snmpCommunity: 'private' })
        );

        expect(result.snmpCommunity).toBe('private');
      });

      it('should pass through the SNMPv3 auth fields when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({
            snmpVersion: 3,
            snmpV3AuthUser: 'adminUser',
            snmpV3AuthProto: 'MD5',
            snmpV3AuthKey: 'authsecret'
          })
        );

        expect(result.snmpV3AuthUser).toBe('adminUser');
        expect(result.snmpV3AuthProto).toBe('MD5');
        expect(result.snmpV3AuthKey).toBe('authsecret');
      });

      it('should pass through the SNMPv3 privacy fields when provided', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({
            snmpVersion: 3,
            snmpV3PrivProto: 'DES',
            snmpV3PrivKey: 'privsecret'
          })
        );

        expect(result.snmpV3PrivProto).toBe('DES');
        expect(result.snmpV3PrivKey).toBe('privsecret');
      });
    });

    // ------------------------------------------------------------------------
    describe('SNMP fields — absent but stored (carried forward)', () => {
      const stored = () =>
        makeCredentials({
          snmpVersion: 3,
          snmpCommunity: 'stored-community',
          snmpV3AuthUser: 'stored-user',
          snmpV3AuthProto: 'SHA',
          snmpV3AuthKey: 'stored-auth-key',
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: 'stored-priv-key',
          snmpPort: 1161
        });

      it('should keep the stored snmpVersion', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest(),
          stored()
        );

        expect(result.snmpVersion).toBe(3);
      });

      it('should keep the stored snmpCommunity', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest(),
          stored()
        );

        expect(result.snmpCommunity).toBe('stored-community');
      });

      it('should keep the stored SNMPv3 fields', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest(),
          stored()
        );

        expect(result.snmpV3AuthUser).toBe('stored-user');
        expect(result.snmpV3AuthProto).toBe('SHA');
        expect(result.snmpV3AuthKey).toBe('stored-auth-key');
        expect(result.snmpV3PrivProto).toBe('AES');
        expect(result.snmpV3PrivKey).toBe('stored-priv-key');
      });

      it('should keep the stored snmpPort', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest(),
          stored()
        );

        expect(result.snmpPort).toBe(1161);
      });

      it('should prefer a provided SNMP value over the stored one', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({
            snmpVersion: 2,
            snmpCommunity: 'fresh-community'
          }),
          stored()
        );

        expect(result.snmpVersion).toBe(2);
        expect(result.snmpCommunity).toBe('fresh-community');
      });

      it('should treat a null existing row as nothing stored', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest(),
          null
        );

        expect(result.snmpVersion).toBe(1);
        expect(result.snmpCommunity).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('SNMP fields — explicit null clears the stored value', () => {
      it('should clear a stored snmpCommunity when null is sent', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpCommunity: null }),
          makeCredentials({ snmpCommunity: 'stored-community' })
        );

        expect(result.snmpCommunity).toBeNull();
      });

      it('should clear a stored snmpV3AuthUser when null is sent', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpV3AuthUser: null }),
          makeCredentials({ snmpV3AuthUser: 'stored-user' })
        );

        expect(result.snmpV3AuthUser).toBeNull();
      });

      it('should clear only the fields sent as null', () => {
        const result = DeviceCredentialsMapper.extractCreateData(
          makeRequest({ snmpV3PrivKey: null }),
          makeCredentials({
            snmpV3AuthKey: 'stored-auth-key',
            snmpV3PrivKey: 'stored-priv-key'
          })
        );

        expect(result.snmpV3PrivKey).toBeNull();
        expect(result.snmpV3AuthKey).toBe('stored-auth-key');
      });
    });
  });

  // ==========================================================================
  describe('mapper compliance', () => {
    it('should expose toDTO as a static method', () => {
      expect(typeof DeviceCredentialsMapper.toDTO).toBe('function');
    });

    it('should expose extractCreateData as a static method', () => {
      expect(typeof DeviceCredentialsMapper.extractCreateData).toBe(
        'function'
      );
    });
  });
});
