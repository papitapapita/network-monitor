// Source: src/domain/device-monitoring/entities/PortExpectedSpeed.ts

import {
  PortExpectedSpeed,
  PortExpectedSpeedInput
} from '../../../../src/domain/device-monitoring/entities/PortExpectedSpeed';
import { DeviceId } from '../../../../src/domain/shared/ids';

const DEVICE_ID = DeviceId.parse(
  '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60'
).value;

function makeInput(
  overrides: Partial<PortExpectedSpeedInput> = {}
): PortExpectedSpeedInput {
  return {
    deviceId: DEVICE_ID,
    portName: 'ether3',
    expectedMbps: 1000,
    ...overrides
  };
}

const makeSpeed = (overrides: Partial<PortExpectedSpeedInput> = {}) =>
  PortExpectedSpeed.create(makeInput(overrides)).value;

describe('PortExpectedSpeed', () => {
  describe('create', () => {
    it('[MON-142] should keep the device, port and speed', () => {
      const speed = makeSpeed();

      expect(speed.deviceId.equals(DEVICE_ID)).toBe(true);
      expect(speed.portName).toBe('ether3');
      expect(speed.expected.mbps).toBe(1000);
    });

    it('[MON-142] should trim the port name', () => {
      expect(makeSpeed({ portName: '  sfp1 ' }).portName).toBe(
        'sfp1'
      );
    });

    it('[MON-142] should refuse a blank port name', () => {
      const result = PortExpectedSpeed.create(
        makeInput({ portName: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('portName is required');
    });

    it('[MON-142] should refuse a port name over 64 characters', () => {
      const result = PortExpectedSpeed.create(
        makeInput({ portName: 'e'.repeat(65) })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/at most 64/);
    });

    it('[MON-142] should refuse a speed ports do not link at', () => {
      const result = PortExpectedSpeed.create(
        makeInput({ expectedMbps: 500 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/must be one of/);
    });

    it('should refuse missing fields', () => {
      const result = PortExpectedSpeed.create(
        makeInput({ portName: undefined as unknown as string })
      );

      expect(result.isFailure).toBe(true);
    });
  });

  describe('changeTo', () => {
    it('[MON-142] should change the speed', () => {
      const speed = makeSpeed();

      expect(speed.changeTo(100).isSuccess).toBe(true);
      expect(speed.expected.mbps).toBe(100);
    });

    it('[MON-142] should keep the old speed when the new one is refused', () => {
      const speed = makeSpeed();

      expect(speed.changeTo(123).isFailure).toBe(true);
      expect(speed.expected.mbps).toBe(1000);
    });
  });

  describe('isMetBy', () => {
    it('[MON-143] should be met at the expected rate, full duplex', () => {
      expect(
        makeSpeed().isMetBy({ rateMbps: 1000, fullDuplex: true })
      ).toBe(true);
    });

    it('[MON-143] should be met above the expected rate', () => {
      expect(
        makeSpeed({ expectedMbps: 100 }).isMetBy({
          rateMbps: 1000,
          fullDuplex: true
        })
      ).toBe(true);
    });

    it('[MON-143] should not be met below the expected rate', () => {
      expect(
        makeSpeed().isMetBy({ rateMbps: 100, fullDuplex: true })
      ).toBe(false);
    });

    it('[MON-143] should not be met at half duplex', () => {
      expect(
        makeSpeed({ expectedMbps: 100 }).isMetBy({
          rateMbps: 100,
          fullDuplex: false
        })
      ).toBe(false);
    });
  });
  describe('recordCheck', () => {
    const AT = new Date('2026-10-28T15:00:00Z');
    const LATER = new Date('2026-10-28T15:10:00Z');

    it('[MON-147] should start with no streak and no alert', () => {
      const speed = makeSpeed();

      expect(speed.slowChecks).toBe(0);
      expect(speed.alertedAt).toBeNull();
    });

    it('[MON-147] should raise on the second short check in a row', () => {
      const speed = makeSpeed();

      expect(speed.recordCheck('SHORT', AT)).toBeNull();
      expect(speed.recordCheck('SHORT', LATER)).toBe('RAISED');
      expect(speed.alertedAt).toEqual(LATER);
    });

    it('[MON-147] should raise only once per streak', () => {
      const speed = makeSpeed();
      speed.recordCheck('SHORT', AT);
      speed.recordCheck('SHORT', AT);

      expect(speed.recordCheck('SHORT', LATER)).toBeNull();
      expect(speed.slowChecks).toBe(3);
    });

    it('[MON-147] should recover a raised port that meets its speed', () => {
      const speed = makeSpeed();
      speed.recordCheck('SHORT', AT);
      speed.recordCheck('SHORT', AT);

      expect(speed.recordCheck('MET', LATER)).toBe('RECOVERED');
      expect(speed.alertedAt).toBeNull();
      expect(speed.slowChecks).toBe(0);
    });

    it('[MON-147] should not recover a port that was never raised', () => {
      const speed = makeSpeed();
      speed.recordCheck('SHORT', AT);

      expect(speed.recordCheck('MET', LATER)).toBeNull();
      expect(speed.slowChecks).toBe(0);
    });

    it('[MON-147] should break the streak but keep the alert on an unjudged check', () => {
      const speed = makeSpeed();
      speed.recordCheck('SHORT', AT);
      speed.recordCheck('SHORT', AT);

      expect(speed.recordCheck('UNJUDGED', LATER)).toBeNull();
      expect(speed.slowChecks).toBe(0);
      expect(speed.alertedAt).toEqual(AT);
    });

    it('[MON-147] should not raise across an unjudged check', () => {
      const speed = makeSpeed();
      speed.recordCheck('SHORT', AT);
      speed.recordCheck('UNJUDGED', AT);

      expect(speed.recordCheck('SHORT', LATER)).toBeNull();
    });
  });
});
