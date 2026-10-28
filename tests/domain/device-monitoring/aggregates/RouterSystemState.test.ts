// Source: src/domain/device-monitoring/aggregates/RouterSystemState.ts

import {
  RouterSystemState,
  routerHealthValue
} from '../../../../src/domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import { RouterSystemReadingProps } from '../../../../src/domain/device-monitoring/props';
import { DeviceId } from '../../../../src/domain/shared/ids';

const DEVICE_ID = DeviceId.parse(
  '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60'
).value;
const AT = new Date('2026-10-28T15:00:00Z');
const LATER = new Date('2026-10-28T15:10:00Z');

function makeReading(
  overrides: Partial<RouterSystemReadingProps> = {}
): RouterSystemReadingProps {
  return {
    identity: 'Core',
    model: 'RB4011iGS+',
    serialNumber: 'D4440E1A2B3C',
    macAddress: 'DC:2C:6E:00:00:01',
    boardName: 'RB4011iGS+',
    routerOsVersion: '7.15.3',
    currentFirmware: '7.15.3',
    upgradeFirmware: '7.15.3',
    uptimeSeconds: 3600,
    cpuLoadPercent: 5,
    freeMemoryBytes: 500,
    totalMemoryBytes: 1000,
    freeHddBytes: 300,
    totalHddBytes: 1000,
    voltage: 24,
    temperatureC: 40,
    ...overrides
  };
}

describe('RouterSystemState', () => {
  it('[MON-161] should start with no reading and no error', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);

    expect(state.deviceId.equals(DEVICE_ID)).toBe(true);
    expect(state.reading).toBeNull();
    expect(state.readAt).toBeNull();
    expect(state.lastError).toBeNull();
    expect(state.attemptedAt).toEqual(AT);
  });

  it('[MON-161] should keep a reading and clear the last error', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    state.recordFailure('timeout', AT);

    state.recordReading(makeReading(), LATER);

    expect(state.reading).toEqual(makeReading());
    expect(state.readAt).toEqual(LATER);
    expect(state.lastError).toBeNull();
    expect(state.attemptedAt).toEqual(LATER);
  });

  it('[MON-161] should keep the last good reading when a read fails', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    state.recordReading(makeReading(), AT);

    state.recordFailure('RouterOS API error: timeout', LATER);

    expect(state.reading).toEqual(makeReading());
    expect(state.readAt).toEqual(AT);
    expect(state.lastError).toBe('RouterOS API error: timeout');
    expect(state.attemptedAt).toEqual(LATER);
  });

  it('[MON-161] should cut a long error', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);

    state.recordFailure('x'.repeat(600), AT);

    expect(state.lastError).toHaveLength(500);
  });

  it('[MON-161] should not share the reading it was given', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    const reading = makeReading();
    state.recordReading(reading, AT);

    reading.identity = 'changed';

    expect(state.reading?.identity).toBe('Core');
  });
});

const minutes = (n: number) => new Date(AT.getTime() + n * 60_000);

function readAt(
  state: RouterSystemState,
  at: Date,
  overrides: Partial<RouterSystemReadingProps> = {}
) {
  return state.recordReading(makeReading(overrides), at);
}

describe('RouterSystemState reboots', () => {
  it('[MON-170] should know when the router started', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: 600 });

    expect(state.bootedAt).toEqual(minutes(-10));
  });

  it('[MON-170] should not know when it started without an uptime', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: null });

    expect(state.bootedAt).toBeNull();
  });

  it('[MON-170] should find no reboot on the first reading', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);

    expect(readAt(state, AT, { uptimeSeconds: 5 })).toEqual({
      rebootedAt: null
    });
  });

  it('[MON-170] should find no reboot while the uptime keeps counting', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: 3600 });

    // 30 s of drift between the two clocks
    const change = readAt(state, minutes(10), {
      uptimeSeconds: 3600 + 600 - 30
    });

    expect(change.rebootedAt).toBeNull();
  });

  it('[MON-170] should find a reboot when the uptime went back', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: 3600 });

    const change = readAt(state, minutes(10), { uptimeSeconds: 120 });

    expect(change.rebootedAt).toEqual(minutes(8));
  });

  it('[MON-170] should find a reboot while it was out of reach, even with a longer uptime', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: 600 });
    state.recordFailure('timeout', minutes(10));

    const change = readAt(state, minutes(24 * 60), {
      uptimeSeconds: 3600
    });

    expect(change.rebootedAt).toEqual(minutes(23 * 60));
  });

  it('[MON-170] should compare with the last good reading across failed reads', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    readAt(state, AT, { uptimeSeconds: 3600 });
    state.recordFailure('timeout', minutes(10));

    const change = readAt(state, minutes(20), { uptimeSeconds: 60 });

    expect(change.rebootedAt).toEqual(minutes(19));
  });
});

describe('RouterSystemState health', () => {
  const DEFAULTS = RouterHealthThresholds.defaults();
  const withVoltage = RouterHealthThresholds.create({
    ...DEFAULTS.values,
    minVoltage: 22
  }).value;

  function judged(
    overrides: Partial<RouterSystemReadingProps>,
    state = RouterSystemState.createInitial(DEVICE_ID, AT),
    thresholds = DEFAULTS
  ) {
    readAt(state, LATER, overrides);
    return { state, change: state.recordHealthCheck(thresholds) };
  }

  it('[MON-173] should raise nothing for a healthy router', () => {
    const { state, change } = judged({});

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(state.healthIssues).toEqual([]);
  });

  it('[MON-173] should raise the CPU only on the second check in a row above its limit', () => {
    const { state, change: first } = judged({ cpuLoadPercent: 95 });
    const { change: second } = judged({ cpuLoadPercent: 97 }, state);

    expect(first.raised).toEqual([]);
    expect(state.highCpuChecks).toBe(2);
    expect(second.raised).toEqual(['CPU']);
    expect(state.healthIssues).toEqual(['CPU']);
  });

  it('[MON-173] should start the CPU streak over after a check at or under the limit', () => {
    const { state } = judged({ cpuLoadPercent: 95 });
    judged({ cpuLoadPercent: 90 }, state);
    const { change } = judged({ cpuLoadPercent: 95 }, state);

    expect(change.raised).toEqual([]);
    expect(state.highCpuChecks).toBe(1);
  });

  it('[MON-173] should recover the CPU once it is at or under the limit', () => {
    const { state } = judged({ cpuLoadPercent: 95 });
    judged({ cpuLoadPercent: 95 }, state);
    const { change: still } = judged({ cpuLoadPercent: 99 }, state);
    const { change } = judged({ cpuLoadPercent: 40 }, state);

    expect(still).toEqual({ raised: [], recovered: [] });
    expect(change.recovered).toEqual(['CPU']);
    expect(state.healthIssues).toEqual([]);
  });

  it('[MON-173] should raise low free memory and disk on the first check', () => {
    const { change } = judged({
      freeMemoryBytes: 90,
      freeHddBytes: 40
    });

    expect(change.raised).toEqual(['MEMORY', 'DISK']);
  });

  it('[MON-173] should not raise free space exactly at its limit', () => {
    const { change } = judged({
      freeMemoryBytes: 100,
      freeHddBytes: 50
    });

    expect(change.raised).toEqual([]);
  });

  it('[MON-173] should recover free space only 2 points above its limit', () => {
    const { state } = judged({ freeHddBytes: 40 });
    const { change: near } = judged({ freeHddBytes: 60 }, state);
    const { change } = judged({ freeHddBytes: 70 }, state);

    expect(near.recovered).toEqual([]);
    expect(change.recovered).toEqual(['DISK']);
  });

  it('[MON-173] should raise a temperature above the limit and recover it 3 °C under', () => {
    const { state, change: raised } = judged({ temperatureC: 76 });
    const { change: near } = judged({ temperatureC: 73 }, state);
    const { change } = judged({ temperatureC: 72 }, state);

    expect(raised.raised).toEqual(['TEMPERATURE']);
    expect(near.recovered).toEqual([]);
    expect(change.recovered).toEqual(['TEMPERATURE']);
  });

  it('[MON-173] should not judge voltage until a minimum is set', () => {
    const { change } = judged({ voltage: 11 });

    expect(change.raised).toEqual([]);
  });

  it('[MON-173] should raise a voltage under the minimum and recover it 0.5 V above', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    const { change: raised } = judged(
      { voltage: 21.8 },
      state,
      withVoltage
    );
    const { change: near } = judged(
      { voltage: 22.4 },
      state,
      withVoltage
    );
    const { change } = judged({ voltage: 22.5 }, state, withVoltage);

    expect(raised.raised).toEqual(['VOLTAGE']);
    expect(near.recovered).toEqual([]);
    expect(change.recovered).toEqual(['VOLTAGE']);
  });

  it('[MON-173] should drop an open voltage alert without a recovery once the minimum is removed', () => {
    const state = RouterSystemState.createInitial(DEVICE_ID, AT);
    judged({ voltage: 21 }, state, withVoltage);

    const { change } = judged({ voltage: 21 }, state);

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(state.healthIssues).toEqual([]);
  });

  it('[MON-173] should leave an open alert open when the router stops reporting the value', () => {
    const { state } = judged({ temperatureC: 80 });
    const { change } = judged({ temperatureC: null }, state);

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(state.healthIssues).toEqual(['TEMPERATURE']);
  });

  it('[MON-173] should judge nothing on a failed read, ending the CPU streak', () => {
    const { state } = judged({
      cpuLoadPercent: 95,
      temperatureC: 80
    });
    state.recordFailure('timeout', minutes(20));

    const change = state.recordHealthCheck(DEFAULTS);

    expect(change).toEqual({ raised: [], recovered: [] });
    expect(state.highCpuChecks).toBe(0);
    expect(state.healthIssues).toEqual(['TEMPERATURE']);
  });

  it('[MON-173] should not raise again a problem already open', () => {
    const { state } = judged({ temperatureC: 80 });
    const { change } = judged({ temperatureC: 85 }, state);

    expect(change.raised).toEqual([]);
  });
});

describe('routerHealthValue', () => {
  it('[MON-173] should give free memory and disk as a share of the total', () => {
    const reading = makeReading({
      freeMemoryBytes: 1,
      totalMemoryBytes: 3,
      freeHddBytes: 5,
      totalHddBytes: 0
    });

    expect(routerHealthValue('MEMORY', reading)).toBe(33.3);
    expect(routerHealthValue('DISK', reading)).toBeNull();
  });
});
