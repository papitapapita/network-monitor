// Source: src/domain/device-monitoring/services/RouterAudit.ts

import { RouterAudit } from '../../../../src/domain/device-monitoring/services';
import {
  RouterSecurityReadingProps,
  RouterSystemReadingProps
} from '../../../../src/domain/device-monitoring/props';

function makeSecurity(
  overrides: Partial<RouterSecurityReadingProps> = {}
): RouterSecurityReadingProps {
  return {
    services: [
      {
        name: 'winbox',
        port: 8291,
        enabled: true,
        allowedAddresses: ['10.0.0.0/24']
      }
    ],
    userNames: ['noc'],
    discoveryInterfaceList: 'LAN',
    ...overrides
  };
}

function makeReading(
  overrides: Partial<RouterSystemReadingProps> = {}
): RouterSystemReadingProps {
  return {
    identity: 'Core',
    model: 'RB4011iGS+',
    serialNumber: null,
    macAddress: null,
    boardName: null,
    routerOsVersion: '7.15.3',
    currentFirmware: '7.15.3',
    upgradeFirmware: '7.15.3',
    uptimeSeconds: null,
    cpuLoadPercent: null,
    freeMemoryBytes: null,
    totalMemoryBytes: null,
    freeHddBytes: null,
    totalHddBytes: null,
    voltage: null,
    temperatureC: null,
    security: makeSecurity(),
    ...overrides
  };
}

describe('RouterAudit.of', () => {
  it('[MON-181] should find nothing on a hardened, up-to-date router', () => {
    expect(RouterAudit.of(makeReading())).toEqual({
      findings: [],
      unchecked: []
    });
  });

  it('[MON-181] should flag RouterBOARD firmware that differs from the upgrade firmware', () => {
    const { findings } = RouterAudit.of(
      makeReading({
        currentFirmware: '7.12',
        upgradeFirmware: '7.15.3'
      })
    );

    expect(findings).toEqual([
      { code: 'FIRMWARE_BEHIND', service: null, port: null }
    ]);
  });

  it('[MON-181] should not judge firmware a router does not report', () => {
    const { findings } = RouterAudit.of(
      makeReading({ currentFirmware: null, upgradeFirmware: null })
    );

    expect(findings).toEqual([]);
  });

  it('[MON-182] should flag telnet, ftp and www when enabled, not when disabled', () => {
    const { findings } = RouterAudit.of(
      makeReading({
        security: makeSecurity({
          services: [
            {
              name: 'telnet',
              port: 23,
              enabled: true,
              allowedAddresses: ['10.0.0.0/24']
            },
            {
              name: 'ftp',
              port: 21,
              enabled: false,
              allowedAddresses: []
            },
            {
              name: 'www',
              port: 80,
              enabled: true,
              allowedAddresses: ['10.0.0.0/24']
            },
            {
              name: 'www-ssl',
              port: 443,
              enabled: true,
              allowedAddresses: ['10.0.0.0/24']
            }
          ]
        })
      })
    );

    expect(findings).toEqual([
      { code: 'PLAINTEXT_SERVICE', service: 'telnet', port: 23 },
      { code: 'PLAINTEXT_SERVICE', service: 'www', port: 80 }
    ]);
  });

  it('[MON-183] should flag an enabled service open to any address', () => {
    const { findings } = RouterAudit.of(
      makeReading({
        security: makeSecurity({
          services: [
            {
              name: 'api',
              port: 8728,
              enabled: true,
              allowedAddresses: []
            },
            {
              name: 'ssh',
              port: 22,
              enabled: true,
              allowedAddresses: ['0.0.0.0/0', '::/0']
            },
            {
              name: 'winbox',
              port: 8291,
              enabled: true,
              allowedAddresses: ['10.0.0.0/24']
            },
            {
              name: 'ftp',
              port: 21,
              enabled: false,
              allowedAddresses: []
            }
          ]
        })
      })
    );

    expect(findings).toEqual([
      { code: 'UNRESTRICTED_SERVICE', service: 'api', port: 8728 },
      { code: 'UNRESTRICTED_SERVICE', service: 'ssh', port: 22 }
    ]);
  });

  it('[MON-183] should name a service once even when listed twice', () => {
    const api = {
      name: 'api',
      port: 8728,
      enabled: true,
      allowedAddresses: []
    };

    const { findings } = RouterAudit.of(
      makeReading({
        security: makeSecurity({ services: [api, api] })
      })
    );

    expect(findings).toEqual([
      { code: 'UNRESTRICTED_SERVICE', service: 'api', port: 8728 }
    ]);
  });

  it('[MON-184] should flag an enabled admin user', () => {
    const { findings } = RouterAudit.of(
      makeReading({
        security: makeSecurity({ userNames: ['admin', 'noc'] })
      })
    );

    expect(findings).toEqual([
      { code: 'ADMIN_USER', service: null, port: null }
    ]);
  });

  it('[MON-185] should flag neighbour discovery on all interfaces', () => {
    const { findings } = RouterAudit.of(
      makeReading({
        security: makeSecurity({ discoveryInterfaceList: 'all' })
      })
    );

    expect(findings).toEqual([
      {
        code: 'DISCOVERY_ON_ALL_INTERFACES',
        service: null,
        port: null
      }
    ]);
  });

  it('[MON-186] should list each part the router did not let the app read', () => {
    expect(
      RouterAudit.of(
        makeReading({
          security: makeSecurity({
            userNames: null,
            discoveryInterfaceList: null
          })
        })
      ).unchecked
    ).toEqual(['USERS', 'DISCOVERY']);
    expect(
      RouterAudit.of(makeReading({ security: null })).unchecked
    ).toEqual(['SERVICES', 'USERS', 'DISCOVERY']);
  });
});

describe('RouterAudit.compareVersions', () => {
  it('[MON-186] should sort RouterOS versions oldest first, unknown last', () => {
    const versions = [
      null,
      '7.21.4',
      '7.9',
      '6.49.10',
      '7.22',
      '7.22beta3',
      '7.22rc1',
      '7.21'
    ];

    expect([...versions].sort(RouterAudit.compareVersions)).toEqual([
      '6.49.10',
      '7.9',
      '7.21',
      '7.21.4',
      '7.22beta3',
      '7.22rc1',
      '7.22',
      null
    ]);
  });

  it('[MON-186] should treat equal versions as equal', () => {
    expect(RouterAudit.compareVersions('7.15.3', '7.15.3')).toBe(0);
    expect(RouterAudit.compareVersions('7.15', '7.15.0')).toBe(0);
  });
});
