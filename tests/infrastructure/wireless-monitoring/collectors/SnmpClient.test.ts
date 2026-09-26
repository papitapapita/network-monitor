// Source: src/infrastructure/wireless-monitoring/collectors/SnmpClient.ts

import * as snmp from 'net-snmp';
import { SnmpClient } from '../../../../src/infrastructure/wireless-monitoring/collectors/SnmpClient';
import { DecryptedCredentials } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceCredentialsRepository';

jest.mock('net-snmp', () => {
  const actual = jest.requireActual('net-snmp');
  return {
    ...actual,
    createSession: jest.fn(),
    createV3Session: jest.fn()
  };
});

const mockedSnmp = snmp as jest.Mocked<typeof snmp>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCredentials(
  overrides: Partial<DecryptedCredentials> = {}
): DecryptedCredentials {
  return {
    snmpVersion: 2,
    snmpCommunity: 'nms-ro',
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    httpUsername: null,
    httpPassword: null,
    snmpPort: 161,
    httpPort: 443,
    ...overrides
  };
}

interface FakeSession {
  get: jest.Mock;
  close: jest.Mock;
}

function makeSession(
  error: Error | null,
  varbinds: snmp.Varbind[] = []
): FakeSession {
  const session: FakeSession = {
    get: jest.fn((_oids: string[], cb: snmp.GetSetCallback) => {
      cb(error as snmp.ResponseInvalidError | null, varbinds);
      return session;
    }),
    close: jest.fn()
  };
  return session;
}

function useSession(session: FakeSession): void {
  const s = session as unknown as snmp.Session;
  mockedSnmp.createSession.mockReturnValue(s);
  mockedSnmp.createV3Session.mockReturnValue(s);
}

// ---------------------------------------------------------------------------

describe('SnmpClient', () => {
  const client = new SnmpClient(5_000, 1);

  beforeEach(() => jest.clearAllMocks());

  describe('get', () => {
    it('should return answered OIDs and drop the ones the agent lacks', async () => {
      useSession(
        makeSession(null, [
          {
            oid: '1.3.6.1.2.1.1.5.0',
            type: 4,
            value: Buffer.from('ap')
          },
          {
            oid: '1.3.6.1.2.1.1.9.9.0',
            type: snmp.ObjectType.NoSuchObject,
            value: null
          }
        ])
      );

      const result = await client.get('10.0.0.1', makeCredentials(), [
        '1.3.6.1.2.1.1.5.0',
        '1.3.6.1.2.1.1.9.9.0'
      ]);

      expect(result.isSuccess).toBe(true);
      expect([...result.value.keys()]).toEqual(['1.3.6.1.2.1.1.5.0']);
    });

    it('should fail and close the session on a request error', async () => {
      const session = makeSession(new Error('Request timed out'));
      useSession(session);

      const result = await client.get('10.0.0.1', makeCredentials(), [
        '1.3.6.1.2.1.1.5.0'
      ]);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Request timed out');
      expect(session.close).toHaveBeenCalled();
    });
  });

  describe('session selection', () => {
    it('should open a v2c session with the community and SNMP port', async () => {
      useSession(makeSession(null));

      await client.get(
        '10.0.0.1',
        makeCredentials({ snmpPort: 1161 }),
        []
      );

      expect(mockedSnmp.createSession).toHaveBeenCalledWith(
        '10.0.0.1',
        'nms-ro',
        expect.objectContaining({
          port: 1161,
          timeout: 5_000,
          retries: 1,
          version: snmp.Version2c
        })
      );
    });

    it('should open a v1 session when configured for v1', async () => {
      useSession(makeSession(null));

      await client.get(
        '10.0.0.1',
        makeCredentials({ snmpVersion: 1 }),
        []
      );

      expect(mockedSnmp.createSession).toHaveBeenCalledWith(
        '10.0.0.1',
        'nms-ro',
        expect.objectContaining({ version: snmp.Version1 })
      );
    });

    it('should fail without a community for v1/v2c', async () => {
      const result = await client.get(
        '10.0.0.1',
        makeCredentials({ snmpCommunity: null }),
        []
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('community');
      expect(mockedSnmp.createSession).not.toHaveBeenCalled();
    });

    it('should open an authPriv v3 session when auth and priv keys are set', async () => {
      useSession(makeSession(null));

      await client.get(
        '10.0.0.1',
        makeCredentials({
          snmpVersion: 3,
          snmpV3AuthUser: 'nms',
          snmpV3AuthProto: 'SHA',
          snmpV3AuthKey: 'authpass',
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: 'privpass'
        }),
        []
      );

      expect(mockedSnmp.createV3Session).toHaveBeenCalledWith(
        '10.0.0.1',
        {
          name: 'nms',
          level: snmp.SecurityLevel.authPriv,
          authProtocol: snmp.AuthProtocols.sha,
          authKey: 'authpass',
          privProtocol: snmp.PrivProtocols.aes,
          privKey: 'privpass'
        },
        expect.objectContaining({ version: snmp.Version3 })
      );
    });

    it('should use authNoPriv when only an auth key is set', async () => {
      useSession(makeSession(null));

      await client.get(
        '10.0.0.1',
        makeCredentials({
          snmpVersion: 3,
          snmpV3AuthUser: 'nms',
          snmpV3AuthProto: 'MD5',
          snmpV3AuthKey: 'authpass'
        }),
        []
      );

      expect(mockedSnmp.createV3Session).toHaveBeenCalledWith(
        '10.0.0.1',
        expect.objectContaining({
          level: snmp.SecurityLevel.authNoPriv,
          authProtocol: snmp.AuthProtocols.md5
        }),
        expect.anything()
      );
    });

    it('should fail v3 without a username', async () => {
      const result = await client.get(
        '10.0.0.1',
        makeCredentials({ snmpVersion: 3 }),
        []
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('username');
    });
  });
});
