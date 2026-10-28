// Source: src/domain/device-monitoring/aggregates/RouterPortCounters.ts

import { RouterPortCounters } from '../../../../src/domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import { PortCounterReadingProps } from '../../../../src/domain/device-monitoring/props';
import { DeviceId } from '../../../../src/domain/shared/ids';

const DEVICE_ID = DeviceId.parse(
  '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60'
).value;
const AT = new Date('2026-10-28T15:00:00Z');
const DEFAULTS = RouterHealthThresholds.defaults();
const NO_SFP_ALERT = RouterHealthThresholds.create({
  ...DEFAULTS.values,
  minSfpRxPowerDbm: null
}).value;

function reading(
  overrides: Partial<PortCounterReadingProps> = {}
): PortCounterReadingProps {
  return {
    name: 'ether1',
    rxErrors: 0,
    linkDowns: 0,
    sfpRxPowerDbm: null,
    ...overrides
  };
}

// Records one check per reading, in order, and returns every change.
function checks(
  readings: Partial<PortCounterReadingProps>[],
  counters = RouterPortCounters.createInitial(DEVICE_ID),
  thresholds = DEFAULTS
) {
  const changes = readings.map((r) =>
    counters.recordCheck([reading(r)], thresholds, AT)
  );
  return { counters, changes, last: changes[changes.length - 1]! };
}

describe('RouterPortCounters', () => {
  it('[MON-191] should keep the first reading as a baseline, adding nothing', () => {
    const { counters, last } = checks([{ rxErrors: 50, linkDowns: 7 }]);

    expect(counters.port('ether1')).toEqual({
      portName: 'ether1',
      rxErrors: 50,
      linkDowns: 7,
      readAt: AT,
      errorsAdded: null,
      linkDownsAdded: null,
      errorChecks: 0,
      quietChecks: 0,
      issues: []
    });
    expect(last).toEqual({ raised: [], recovered: [] });
  });

  it('[MON-191] should count what was added since the check before', () => {
    const { counters } = checks([
      { rxErrors: 50, linkDowns: 7 },
      { rxErrors: 58, linkDowns: 8 }
    ]);

    expect(counters.port('ether1')).toMatchObject({
      errorsAdded: 8,
      linkDownsAdded: 1
    });
  });

  it('[MON-191] should take a lower counter as a reset, adding nothing', () => {
    const { counters } = checks([
      { rxErrors: 50, linkDowns: 7 },
      { rxErrors: 3, linkDowns: 0 }
    ]);

    expect(counters.port('ether1')).toMatchObject({
      rxErrors: 3,
      errorsAdded: null,
      linkDownsAdded: null,
      errorChecks: 0
    });
  });

  it('[MON-191] should add nothing for a counter the router does not report', () => {
    const { counters } = checks([
      { rxErrors: null },
      { rxErrors: null }
    ]);

    expect(counters.port('ether1')!.errorsAdded).toBeNull();
  });

  it('[MON-191] should forget a port the router no longer lists, with its alert', () => {
    const { counters } = checks([{ linkDowns: 0 }, { linkDowns: 5 }]);
    expect(counters.port('ether1')!.issues).toEqual(['FLAPPING']);

    const change = counters.recordCheck(
      [reading({ name: 'ether2' })],
      DEFAULTS,
      AT
    );

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(counters.ports.map((p) => p.portName)).toEqual(['ether2']);
  });

  it('[MON-193] should raise errors only on the second check in a row that adds some', () => {
    const { changes, counters } = checks([
      { rxErrors: 0 },
      { rxErrors: 4 },
      { rxErrors: 9 }
    ]);

    expect(changes[1]!.raised).toEqual([]);
    expect(changes[2]!.raised).toEqual([
      { portName: 'ether1', issue: 'ERRORS' }
    ]);
    expect(counters.port('ether1')!.errorChecks).toBe(2);
  });

  it('[MON-193] should start the error streak over after a check that adds none', () => {
    const { last } = checks([
      { rxErrors: 0 },
      { rxErrors: 4 },
      { rxErrors: 4 },
      { rxErrors: 6 }
    ]);

    expect(last.raised).toEqual([]);
  });

  it('[MON-193] should recover errors after two checks in a row that add none', () => {
    const { changes } = checks([
      { rxErrors: 0 },
      { rxErrors: 4 },
      { rxErrors: 9 },
      { rxErrors: 9 },
      { rxErrors: 9 }
    ]);

    expect(changes[3]!.recovered).toEqual([]);
    expect(changes[4]!.recovered).toEqual([
      { portName: 'ether1', issue: 'ERRORS' }
    ]);
  });

  it('[MON-193] should keep the error alert open across a counter reset', () => {
    const { counters, changes } = checks([
      { rxErrors: 0 },
      { rxErrors: 4 },
      { rxErrors: 9 },
      { rxErrors: 0 },
      { rxErrors: 0 }
    ]);

    expect(changes[4]!.recovered).toEqual([]);
    expect(counters.port('ether1')!.issues).toEqual(['ERRORS']);
  });

  it('[MON-194] should raise flapping when one check adds the limit of link-downs', () => {
    const { changes } = checks([
      { linkDowns: 0 },
      { linkDowns: 2 },
      { linkDowns: 5 }
    ]);

    expect(changes[1]!.raised).toEqual([]);
    expect(changes[2]!.raised).toEqual([
      { portName: 'ether1', issue: 'FLAPPING' }
    ]);
  });

  it('[MON-194] should recover flapping on a check with no link-down, not on a few', () => {
    const { changes } = checks([
      { linkDowns: 0 },
      { linkDowns: 3 },
      { linkDowns: 4 },
      { linkDowns: 4 }
    ]);

    expect(changes[2]!.recovered).toEqual([]);
    expect(changes[3]!.recovered).toEqual([
      { portName: 'ether1', issue: 'FLAPPING' }
    ]);
  });

  it('[MON-195] should raise low fibre power on the first check under the minimum', () => {
    const { last } = checks([{ sfpRxPowerDbm: -20.1 }]);

    expect(last.raised).toEqual([
      { portName: 'ether1', issue: 'SFP_RX_LOW' }
    ]);
  });

  it('[MON-195] should recover low fibre power only 1 dB above the minimum', () => {
    const { changes } = checks([
      { sfpRxPowerDbm: -21 },
      { sfpRxPowerDbm: -19.5 },
      { sfpRxPowerDbm: -19 }
    ]);

    expect(changes[1]!.recovered).toEqual([]);
    expect(changes[2]!.recovered).toEqual([
      { portName: 'ether1', issue: 'SFP_RX_LOW' }
    ]);
  });

  it('[MON-195] should leave low fibre power open while the module gives no reading', () => {
    const { counters, last } = checks([
      { sfpRxPowerDbm: -25 },
      { sfpRxPowerDbm: null }
    ]);

    expect(last).toEqual({ raised: [], recovered: [] });
    expect(counters.port('ether1')!.issues).toEqual(['SFP_RX_LOW']);
  });

  it('[MON-195] should drop an open fibre alert silently once the minimum is removed', () => {
    const { counters } = checks([{ sfpRxPowerDbm: -25 }]);

    const change = counters.recordCheck(
      [reading({ sfpRxPowerDbm: -25 })],
      NO_SFP_ALERT,
      AT
    );

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(counters.port('ether1')!.issues).toEqual([]);
  });

  it('should not share its ports with the caller', () => {
    const { counters } = checks([{ sfpRxPowerDbm: -25 }]);

    counters.port('ether1')!.issues.push('ERRORS');
    counters.ports[0]!.issues.length = 0;

    expect(counters.port('ether1')!.issues).toEqual(['SFP_RX_LOW']);
  });
});
