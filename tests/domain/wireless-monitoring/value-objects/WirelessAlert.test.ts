// Source: src/domain/wireless-monitoring/value-objects/WirelessAlert.ts

import { WirelessAlert } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessAlert';
import { WirelessAlertProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertProps';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z');

function makeProps(
  overrides: Partial<WirelessAlertProps> = {}
): WirelessAlertProps {
  return {
    metric: 'signalRxDbm',
    severity: 'WARNING',
    threshold: -70,
    currentValue: -75,
    message: 'Signal has dropped below the warning threshold.',
    triggeredAt: FIXED_DATE,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('WirelessAlert', () => {
  // ===========================================================================
  describe('create()', () => {
    describe('when props are valid', () => {
      it('should return a successful Result wrapping a WirelessAlert instance', () => {
        const result = WirelessAlert.create(makeProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(WirelessAlert);
      });

      it('should succeed with severity WARNING', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: 'WARNING' })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.severity).toBe('WARNING');
      });

      it('should succeed with severity CRITICAL', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: 'CRITICAL' })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.severity).toBe('CRITICAL');
      });

      it('should succeed when threshold and currentValue are negative numbers', () => {
        const result = WirelessAlert.create(
          makeProps({ threshold: -90, currentValue: -95 })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when threshold and currentValue are zero', () => {
        const result = WirelessAlert.create(
          makeProps({ threshold: 0, currentValue: 0 })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when currentValue is better than threshold (inverse alert scenario)', () => {
        const result = WirelessAlert.create(
          makeProps({ threshold: 80, currentValue: 95 })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    describe('when props object itself is null or undefined', () => {
      it('should fail when props is null', () => {
        const result = WirelessAlert.create(
          null as unknown as WirelessAlertProps
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when props is undefined', () => {
        const result = WirelessAlert.create(
          undefined as unknown as WirelessAlertProps
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when metric is invalid', () => {
      it('should fail when metric is null', () => {
        const result = WirelessAlert.create(
          makeProps({ metric: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when metric is undefined', () => {
        const result = WirelessAlert.create(
          makeProps({ metric: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when metric is an empty string', () => {
        const result = WirelessAlert.create(
          makeProps({ metric: '' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('metric cannot be empty');
      });

      it('should fail when metric is a whitespace-only string', () => {
        const result = WirelessAlert.create(
          makeProps({ metric: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('metric cannot be empty');
      });

      it('should fail when metric is not a string', () => {
        const result = WirelessAlert.create(
          makeProps({ metric: 42 as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when message is invalid', () => {
      it('should fail when message is null', () => {
        const result = WirelessAlert.create(
          makeProps({ message: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when message is undefined', () => {
        const result = WirelessAlert.create(
          makeProps({ message: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when message is an empty string', () => {
        const result = WirelessAlert.create(
          makeProps({ message: '' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('message cannot be empty');
      });

      it('should fail when message is a whitespace-only string', () => {
        const result = WirelessAlert.create(
          makeProps({ message: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('message cannot be empty');
      });
    });

    describe('when severity is invalid', () => {
      it('should fail when severity is an unrecognized string', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: 'INFO' as 'WARNING' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          "severity must be 'WARNING' or 'CRITICAL'"
        );
      });

      it('should fail when severity is an empty string', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: '' as 'WARNING' })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when severity is lowercase warning', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: 'warning' as 'WARNING' })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when severity is lowercase critical', () => {
        const result = WirelessAlert.create(
          makeProps({ severity: 'critical' as 'CRITICAL' })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when numeric fields are invalid', () => {
      it('should fail when threshold is not a number', () => {
        const result = WirelessAlert.create(
          makeProps({ threshold: 'high' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when currentValue is not a number', () => {
        const result = WirelessAlert.create(
          makeProps({ currentValue: 'low' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when triggeredAt is invalid', () => {
      it('should fail when triggeredAt is null', () => {
        const result = WirelessAlert.create(
          makeProps({ triggeredAt: null as unknown as Date })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when triggeredAt is undefined', () => {
        const result = WirelessAlert.create(
          makeProps({ triggeredAt: undefined as unknown as Date })
        );

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should return a WirelessAlert instance without validation', () => {
      const props = makeProps();
      const alert = WirelessAlert.reconstitute(props);

      expect(alert).toBeInstanceOf(WirelessAlert);
    });

    it('should preserve all props exactly as supplied', () => {
      const props = makeProps();
      const alert = WirelessAlert.reconstitute(props);

      expect(alert.metric).toBe(props.metric);
      expect(alert.severity).toBe(props.severity);
      expect(alert.threshold).toBe(props.threshold);
      expect(alert.currentValue).toBe(props.currentValue);
      expect(alert.message).toBe(props.message);
      expect(alert.triggeredAt).toBe(props.triggeredAt);
    });
  });

  // ===========================================================================
  describe('getters', () => {
    it('should expose metric', () => {
      const alert = WirelessAlert.create(
        makeProps({ metric: 'ccqPercent' })
      ).value;

      expect(alert.metric).toBe('ccqPercent');
    });

    it('should expose severity', () => {
      const alert = WirelessAlert.create(
        makeProps({ severity: 'CRITICAL' })
      ).value;

      expect(alert.severity).toBe('CRITICAL');
    });

    it('should expose threshold', () => {
      const alert = WirelessAlert.create(
        makeProps({ threshold: -70 })
      ).value;

      expect(alert.threshold).toBe(-70);
    });

    it('should expose currentValue', () => {
      const alert = WirelessAlert.create(
        makeProps({ currentValue: -80 })
      ).value;

      expect(alert.currentValue).toBe(-80);
    });

    it('should expose message', () => {
      const alert = WirelessAlert.create(
        makeProps({ message: 'Signal degraded.' })
      ).value;

      expect(alert.message).toBe('Signal degraded.');
    });

    it('should expose triggeredAt as the exact Date instance supplied', () => {
      const date = new Date('2026-03-10T08:30:00.000Z');
      const alert = WirelessAlert.create(
        makeProps({ triggeredAt: date })
      ).value;

      expect(alert.triggeredAt).toBe(date);
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two alerts with identical props', () => {
      const alertA = WirelessAlert.create(makeProps()).value;
      const alertB = WirelessAlert.create(makeProps()).value;

      expect(alertA.equals(alertB)).toBe(true);
    });

    it('should return false when metric differs', () => {
      const alertA = WirelessAlert.create(
        makeProps({ metric: 'signalRxDbm' })
      ).value;
      const alertB = WirelessAlert.create(
        makeProps({ metric: 'ccqPercent' })
      ).value;

      expect(alertA.equals(alertB)).toBe(false);
    });

    it('should return false when severity differs', () => {
      const alertA = WirelessAlert.create(
        makeProps({ severity: 'WARNING' })
      ).value;
      const alertB = WirelessAlert.create(
        makeProps({ severity: 'CRITICAL' })
      ).value;

      expect(alertA.equals(alertB)).toBe(false);
    });

    it('should return false when threshold differs', () => {
      const alertA = WirelessAlert.create(
        makeProps({ threshold: -70 })
      ).value;
      const alertB = WirelessAlert.create(
        makeProps({ threshold: -80 })
      ).value;

      expect(alertA.equals(alertB)).toBe(false);
    });

    it('should return false when currentValue differs', () => {
      const alertA = WirelessAlert.create(
        makeProps({ currentValue: -75 })
      ).value;
      const alertB = WirelessAlert.create(
        makeProps({ currentValue: -85 })
      ).value;

      expect(alertA.equals(alertB)).toBe(false);
    });

    it('should return false when triggeredAt differs', () => {
      const alertA = WirelessAlert.create(
        makeProps({
          triggeredAt: new Date('2026-01-01T00:00:00.000Z')
        })
      ).value;
      const alertB = WirelessAlert.create(
        makeProps({
          triggeredAt: new Date('2026-06-01T00:00:00.000Z')
        })
      ).value;

      expect(alertA.equals(alertB)).toBe(false);
    });

    it('should return false for null', () => {
      const alert = WirelessAlert.create(makeProps()).value;

      expect(alert.equals(null as unknown as WirelessAlert)).toBe(
        false
      );
    });

    it('should return false for undefined', () => {
      const alert = WirelessAlert.create(makeProps()).value;

      expect(
        alert.equals(undefined as unknown as WirelessAlert)
      ).toBe(false);
    });
  });

  // ===========================================================================
  describe('immutability', () => {
    it('should be frozen after creation via create()', () => {
      const alert = WirelessAlert.create(makeProps()).value;

      expect(Object.isFrozen(alert)).toBe(true);
    });

    it('should be frozen after creation via reconstitute()', () => {
      const alert = WirelessAlert.reconstitute(makeProps());

      expect(Object.isFrozen(alert)).toBe(true);
    });
  });
});
