// Source: src/domain/wireless-monitoring/services/ParentApDrift.ts

import {
  evaluateParentApDrift,
  PARENT_AP_MISMATCH_METRIC,
  PARENT_AP_MISMATCH_POLLS
} from '../../../../src/domain/wireless-monitoring/services/ParentApDrift';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigProps } from '../../../../src/domain/wireless-monitoring/props/WirelessDeviceConfigProps';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects';

const NAMES = { declared: 'AP-Sur', reported: 'AP-Norte' };

function makeConfig(
  overrides: Partial<WirelessDeviceConfigProps> = {}
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.create(),
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApDeviceId: DeviceId.create(),
      parentApMismatchPolls: 0,
      lastPolledAt: null,
      ...overrides
    }
  );
}

describe('[WLS-013] evaluateParentApDrift', () => {
  it('should open a warning once the mismatch has lasted the required polls', () => {
    const config = makeConfig({
      parentApMismatchPolls: PARENT_AP_MISMATCH_POLLS
    });

    const decision = evaluateParentApDrift(
      config,
      false,
      'CPE-Juan',
      NAMES
    );

    expect(decision).toEqual({
      metric: PARENT_AP_MISMATCH_METRIC,
      action: 'OPEN',
      severity: 'WARNING',
      currentValue: PARENT_AP_MISMATCH_POLLS,
      threshold: PARENT_AP_MISMATCH_POLLS,
      message:
        'CPE-Juan está conectado a AP-Norte, pero su AP declarado es AP-Sur'
    });
  });

  it('should not open before the mismatch has lasted the required polls', () => {
    const config = makeConfig({
      parentApMismatchPolls: PARENT_AP_MISMATCH_POLLS - 1
    });

    expect(
      evaluateParentApDrift(config, false, 'CPE-Juan', NAMES)
    ).toBeNull();
  });

  it('should not open again while the alert is active', () => {
    const config = makeConfig({ parentApMismatchPolls: 10 });

    expect(
      evaluateParentApDrift(config, true, 'CPE-Juan', NAMES)
    ).toBeNull();
  });

  it('should not open without the AP names to show', () => {
    const config = makeConfig({
      parentApMismatchPolls: PARENT_AP_MISMATCH_POLLS
    });

    expect(
      evaluateParentApDrift(config, false, 'CPE-Juan', null)
    ).toBeNull();
  });

  it('should clear an active alert once the reported AP matches again', () => {
    const config = makeConfig({ parentApMismatchPolls: 0 });

    const decision = evaluateParentApDrift(
      config,
      true,
      'CPE-Juan',
      null
    );

    expect(decision?.action).toBe('CLEAR');
    expect(decision?.metric).toBe(PARENT_AP_MISMATCH_METRIC);
    expect(decision?.severity).toBe('WARNING');
  });

  it('should clear an active alert once no parent is declared', () => {
    const config = makeConfig({
      parentApDeviceId: null,
      parentApMismatchPolls: 5
    });

    expect(
      evaluateParentApDrift(config, true, 'CPE-Juan', null)?.action
    ).toBe('CLEAR');
  });

  it('should keep an active alert while the mismatch lasts', () => {
    const config = makeConfig({ parentApMismatchPolls: 1 });

    expect(
      evaluateParentApDrift(config, true, 'CPE-Juan', null)
    ).toBeNull();
  });
});
