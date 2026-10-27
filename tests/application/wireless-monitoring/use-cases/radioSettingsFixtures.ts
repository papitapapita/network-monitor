import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import {
  IDeviceReach,
  IDeviceVendorLookup,
  IRadioLoginSource,
  IRadioSettingsGateway,
  RadioLogin
} from '../../../../src/application/wireless-monitoring/interfaces';
import { RadioTargetSources } from '../../../../src/application/wireless-monitoring/services';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

export const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
export const RADIO_IP = '10.0.0.5';
export const LOGIN: RadioLogin = {
  username: 'ubnt',
  password: 'secreto',
  httpPort: 443,
  sshPort: 22
};

export function makeLogger(): jest.Mocked<ILogger> {
  const logger: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

export function makeConfig(
  ipAddress: string | null = RADIO_IP
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      ipAddress: ipAddress ? IPAddress.create(ipAddress).value : null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'ACCESS_POINT',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      provisionedLanSpeedMbps: null,
      parentApMismatchPolls: 0,
      lastPolledAt: null
    }
  );
}

export interface RadioSettingsMocks {
  configRepo: { findByDeviceId: jest.Mock };
  loginSource: jest.Mocked<IRadioLoginSource>;
  vendorLookup: jest.Mocked<IDeviceVendorLookup>;
  deviceReach: jest.Mocked<IDeviceReach>;
  gateway: jest.Mocked<IRadioSettingsGateway>;
  sources: RadioTargetSources;
}

export function makeMocks(): RadioSettingsMocks {
  const configRepo = {
    findByDeviceId: jest
      .fn()
      .mockResolvedValue(Result.ok(makeConfig()))
  };
  const loginSource = {
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(LOGIN))
  };
  const vendorLookup = {
    findVendorSlug: jest.fn().mockResolvedValue(Result.ok('ubiquiti'))
  };
  const deviceReach = {
    isOutOfReach: jest.fn(),
    readerFor: jest
      .fn()
      .mockResolvedValue(Result.ok({ by: 'server' }))
  };
  const gateway = {
    readWirelessSecurity: jest.fn(),
    setHostname: jest.fn()
  };
  return {
    configRepo,
    loginSource,
    vendorLookup,
    deviceReach,
    gateway,
    sources: {
      configRepo:
        configRepo as unknown as IWirelessDeviceConfigRepository,
      loginSource,
      vendorLookup,
      deviceReach
    }
  };
}
