// Source: src/domain/device-monitoring/aggregates/RouterSystemState.ts

import { RouterSystemState } from '../../../../src/domain/device-monitoring/aggregates';
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
    freeMemoryBytes: 1,
    totalMemoryBytes: 2,
    freeHddBytes: 3,
    totalHddBytes: 4,
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
