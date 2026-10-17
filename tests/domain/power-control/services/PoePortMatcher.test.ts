// Source: src/domain/power-control/services/PoePortMatcher.ts

import {
  InventoryDevice,
  LabelledPoePort,
  PoePortMatcher,
  PoePortMatchKind
} from '../../../../src/domain/power-control';

const SITE = 'site-norte';

function makePort(
  label: string,
  overrides: Partial<LabelledPoePort> = {}
): LabelledPoePort {
  return {
    switchDeviceId: 'hex-1',
    switchIp: '10.0.5.2',
    port: 'ether2',
    label,
    ...overrides
  };
}

function makeDevice(
  ipAddress: string,
  overrides: Partial<InventoryDevice> = {}
): InventoryDevice {
  return {
    deviceId: `dev-${ipAddress}`,
    deviceName: `Rocket ${ipAddress}`,
    ipAddress,
    locationId: SITE,
    locationName: 'Torre Norte',
    ...overrides
  };
}

describe('PoePortMatcher', () => {
  it('[PWR-031] should match a port to the device holding its IP', () => {
    const rocket = makeDevice('10.0.5.21');

    const [match] = PoePortMatcher.match(
      [makePort('10.0.5.21')],
      SITE,
      [rocket]
    );

    expect(match).toEqual({
      kind: PoePortMatchKind.MATCHED,
      ip: '10.0.5.21',
      device: rocket
    });
  });

  it('[PWR-032] should flag a device recorded at another site', () => {
    const [match] = PoePortMatcher.match(
      [makePort('10.0.5.21')],
      SITE,
      [makeDevice('10.0.5.21', { locationId: 'site-sur' })]
    );

    expect(match!.kind).toBe(PoePortMatchKind.MATCHED_OTHER_LOCATION);
  });

  it('[PWR-032] should flag a device with no location as at another site', () => {
    const [match] = PoePortMatcher.match(
      [makePort('10.0.5.21')],
      SITE,
      [
        makeDevice('10.0.5.21', {
          locationId: null,
          locationName: null
        })
      ]
    );

    expect(match!.kind).toBe(PoePortMatchKind.MATCHED_OTHER_LOCATION);
  });

  it('[PWR-031] should leave a port without an IP unmatched', () => {
    const [match] = PoePortMatcher.match(
      [makePort('spare')],
      SITE,
      []
    );

    expect(match).toEqual({
      kind: PoePortMatchKind.UNMATCHED,
      ip: null
    });
  });

  it('[PWR-031] should leave a port whose IP no device holds unmatched', () => {
    const [match] = PoePortMatcher.match(
      [makePort('10.0.5.99')],
      SITE,
      []
    );

    expect(match).toEqual({
      kind: PoePortMatchKind.UNMATCHED,
      ip: '10.0.5.99'
    });
  });

  it('[PWR-033] should flag every port sharing an IP, across switches', () => {
    const matches = PoePortMatcher.match(
      [
        makePort('10.0.5.21'),
        makePort('AP 10.0.5.21', {
          switchDeviceId: 'hex-2',
          switchIp: '10.0.5.4'
        }),
        makePort('10.0.5.22', { port: 'ether3' })
      ],
      SITE,
      [makeDevice('10.0.5.21'), makeDevice('10.0.5.22')]
    );

    expect(matches.map((m) => m.kind)).toEqual([
      PoePortMatchKind.DUPLICATE,
      PoePortMatchKind.DUPLICATE,
      PoePortMatchKind.MATCHED
    ]);
  });

  it("[PWR-034] should not take a port labelled with the switch's own IP for an antenna", () => {
    const [match] = PoePortMatcher.match(
      [makePort('uplink 10.0.5.2')],
      SITE,
      [makeDevice('10.0.5.2')]
    );

    expect(match).toEqual({
      kind: PoePortMatchKind.UNMATCHED,
      ip: null
    });
  });

  it('should keep the order of the ports', () => {
    const matches = PoePortMatcher.match(
      [
        makePort('10.0.5.22'),
        makePort('spare'),
        makePort('10.0.5.21')
      ],
      SITE,
      [makeDevice('10.0.5.21'), makeDevice('10.0.5.22')]
    );

    expect(matches.map((m) => m.ip)).toEqual([
      '10.0.5.22',
      null,
      '10.0.5.21'
    ]);
  });
});
