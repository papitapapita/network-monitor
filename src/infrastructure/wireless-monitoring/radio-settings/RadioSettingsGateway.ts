import {
  IAgentRadioSettings,
  IRadioHostnameWriterResolver,
  IRadioSettingsGateway,
  RadioReach,
  RadioSettingsAnswer,
  RadioTarget,
  WirelessSecurityReading
} from 'application/wireless-monitoring/interfaces';
import { AirOsHttpClient } from '../collectors/AirOsHttpClient';
import { readAirOsWirelessSecurity } from './AirOsWirelessSecurity';

const AIROS_VENDOR = 'ubiquiti';

// WLS-225: the radio is reached the way a wireless poll reaches it. Off site
// the agent fetches the configuration with its backup request (AGT-114) and
// this server reads the key out of it, so no agent update is needed for
// that half.
export class RadioSettingsGateway implements IRadioSettingsGateway {
  constructor(
    private readonly airOs: AirOsHttpClient,
    private readonly writers: IRadioHostnameWriterResolver,
    private readonly agents: IAgentRadioSettings
  ) {}

  async readWirelessSecurity(
    reach: RadioReach,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<WirelessSecurityReading>> {
    if (target.vendor.toLowerCase() !== AIROS_VENDOR)
      return unsupported(target.vendor);

    const config = await this.fetchConfig(reach, target);
    if (!config.ok) return config;

    const reading = readAirOsWirelessSecurity(config.value);
    if (reading.isFailure)
      return { ok: false, reason: 'RADIO', error: reading.error };
    return { ok: true, value: reading.value };
  }

  async setHostname(
    reach: RadioReach,
    target: RadioTarget,
    hostname: string
  ): Promise<RadioSettingsAnswer<void>> {
    const writer = this.writers.forVendor(target.vendor);
    if (!writer) return unsupported(target.vendor);

    if (reach.by === 'agent')
      return this.agents.setHostname(reach.agentId, target, hostname);

    const written = await writer.setHostname(
      target.ipAddress,
      target.login,
      hostname
    );
    return written.isSuccess
      ? { ok: true, value: undefined }
      : { ok: false, reason: 'RADIO', error: written.error };
  }

  private async fetchConfig(
    reach: RadioReach,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<string>> {
    if (reach.by === 'agent')
      return this.agents.fetchConfig(reach.agentId, target);

    const fetched = await this.airOs.fetchConfig(
      target.ipAddress,
      target.login.httpPort,
      {
        username: target.login.username,
        password: target.login.password
      }
    );
    return fetched.isSuccess
      ? { ok: true, value: fetched.value }
      : { ok: false, reason: 'RADIO', error: fetched.error };
  }
}

function unsupported(vendor: string): RadioSettingsAnswer<never> {
  return {
    ok: false,
    reason: 'UNSUPPORTED_VENDOR',
    error: `vendor '${vendor}'`
  };
}
