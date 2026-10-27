import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  RenameRadioUseCase,
  RevealWirelessKeyUseCase
} from 'application/wireless-monitoring/use-cases';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { DeviceReachAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceReachAdapter';
import { DeviceVendorAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter';
import { RadioLoginAdapter } from 'infrastructure/wireless-monitoring/adapters/RadioLoginAdapter';
import { AirOsHttpClient } from 'infrastructure/wireless-monitoring/collectors/AirOsHttpClient';
import {
  RadioHostnameWriterRegistry,
  RadioSettingsGateway
} from 'infrastructure/wireless-monitoring/radio-settings';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { FakeAgentRadioSettings, FakeRadio } from './FakeRadio';

// What an AirOS access point's system.cfg says about its Wi-Fi, trimmed.
export const AP_CONFIG = [
  'aaa.status=enabled',
  'aaa.1.status=enabled',
  'aaa.1.wpa.key.1.mgmt=WPA-PSK',
  'aaa.1.wpa.psk=clave-del-ap',
  'radio.1.mode=master',
  'resolv.host.1.name=AP Norte',
  'wireless.1.ssid=AP NORTE 1'
].join('\n');

export interface RadioSettingsStack {
  reveal: RevealWirelessKeyUseCase;
  rename: RenameRadioUseCase;
}

/**
 * Both radio-settings use cases over the real repositories, with the radio
 * and its agent replaced by fakes. `serverOnSite: false` routes radios
 * behind an agent through `agent`.
 */
export function buildRadioSettings(
  prisma: PrismaClient,
  radio: FakeRadio,
  agent: FakeAgentRadioSettings,
  opts: { serverOnSite?: boolean } = {}
): RadioSettingsStack {
  const logger = new WinstonLogger();
  const devices = new PrismaDeviceRepository(prisma);
  const sources = {
    configRepo: new PrismaWirelessDeviceConfigRepository(prisma),
    loginSource: new RadioLoginAdapter(
      new PrismaDeviceCredentialsRepository(prisma)
    ),
    vendorLookup: new DeviceVendorAdapter(
      devices,
      new PrismaDeviceModelRepository(prisma),
      new PrismaVendorRepository(prisma)
    ),
    deviceReach: new DeviceReachAdapter(
      opts.serverOnSite ?? true,
      devices
    )
  };
  const gateway = new RadioSettingsGateway(
    radio as unknown as AirOsHttpClient,
    new RadioHostnameWriterRegistry({ ubiquiti: radio }),
    agent
  );
  return {
    reveal: new RevealWirelessKeyUseCase(sources, gateway, logger),
    rename: new RenameRadioUseCase(sources, gateway, logger)
  };
}
