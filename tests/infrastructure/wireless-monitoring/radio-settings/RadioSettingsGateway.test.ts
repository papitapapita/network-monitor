// Source: src/infrastructure/wireless-monitoring/radio-settings/RadioSettingsGateway.ts

import { Result } from '../../../../src/domain/shared/core';
import {
  IAgentRadioSettings,
  IRadioHostnameWriter,
  RadioTarget
} from '../../../../src/application/wireless-monitoring/interfaces';
import { AirOsHttpClient } from '../../../../src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient';
import {
  RadioHostnameWriterRegistry,
  RadioSettingsGateway
} from '../../../../src/infrastructure/wireless-monitoring/radio-settings';

const CONFIG = [
  'aaa.status=enabled',
  'aaa.1.status=enabled',
  'aaa.1.wpa.key.1.mgmt=WPA-PSK',
  'aaa.1.wpa.psk=secret-key',
  'radio.1.mode=master',
  'wireless.1.ssid=AP Norte'
].join('\n');

function makeTarget(
  overrides: Partial<RadioTarget> = {}
): RadioTarget {
  return {
    ipAddress: '10.0.0.5',
    vendor: 'ubiquiti',
    deviceType: 'ACCESS_POINT',
    login: {
      username: 'ubnt',
      password: 'pw',
      httpPort: 8443,
      sshPort: 22
    },
    ...overrides
  };
}

describe('[WLS-225] RadioSettingsGateway', () => {
  let fetchConfig: jest.Mock;
  let writer: jest.Mocked<IRadioHostnameWriter>;
  let agents: jest.Mocked<IAgentRadioSettings>;
  let gateway: RadioSettingsGateway;

  beforeEach(() => {
    fetchConfig = jest.fn();
    writer = { setHostname: jest.fn() };
    agents = { fetchConfig: jest.fn(), setHostname: jest.fn() };
    gateway = new RadioSettingsGateway(
      { fetchConfig } as unknown as AirOsHttpClient,
      new RadioHostnameWriterRegistry({ ubiquiti: writer }),
      agents
    );
  });

  describe('readWirelessSecurity', () => {
    it('should read the config from this server with the HTTP login', async () => {
      fetchConfig.mockResolvedValue(Result.ok(CONFIG));

      const answer = await gateway.readWirelessSecurity(
        { by: 'server' },
        makeTarget()
      );

      expect(answer).toEqual({
        ok: true,
        value: {
          role: 'ACCESS_POINT',
          ssid: 'AP Norte',
          security: 'WPA_PSK',
          key: 'secret-key'
        }
      });
      expect(fetchConfig).toHaveBeenCalledWith('10.0.0.5', 8443, {
        username: 'ubnt',
        password: 'pw'
      });
      expect(agents.fetchConfig).not.toHaveBeenCalled();
    });

    it('should read the config through the agent the radio sits behind', async () => {
      agents.fetchConfig.mockResolvedValue({
        ok: true,
        value: CONFIG
      });

      const answer = await gateway.readWirelessSecurity(
        { by: 'agent', agentId: 'agent-1' },
        makeTarget()
      );

      expect(answer.ok).toBe(true);
      expect(agents.fetchConfig).toHaveBeenCalledWith(
        'agent-1',
        makeTarget()
      );
      expect(fetchConfig).not.toHaveBeenCalled();
    });

    it('should pass on an agent refusal as it came', async () => {
      agents.fetchConfig.mockResolvedValue({
        ok: false,
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      });

      const answer = await gateway.readWirelessSecurity(
        { by: 'agent', agentId: 'agent-1' },
        makeTarget()
      );

      expect(answer).toEqual({
        ok: false,
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      });
    });

    it('should call a failed HTTP read a radio failure', async () => {
      fetchConfig.mockResolvedValue(
        Result.fail('Authentication failed: HTTP 401')
      );

      const answer = await gateway.readWirelessSecurity(
        { by: 'server' },
        makeTarget()
      );

      expect(answer).toEqual({
        ok: false,
        reason: 'RADIO',
        error: 'Authentication failed: HTTP 401'
      });
    });

    it('should call a file with no wireless mode a radio failure', async () => {
      fetchConfig.mockResolvedValue(Result.ok('netmode=bridge'));

      const answer = await gateway.readWirelessSecurity(
        { by: 'server' },
        makeTarget()
      );

      expect(answer).toMatchObject({ ok: false, reason: 'RADIO' });
    });

    it('[WLS-222] should refuse a radio that is not AirOS without reaching it', async () => {
      const answer = await gateway.readWirelessSecurity(
        { by: 'server' },
        makeTarget({ vendor: 'mimosa' })
      );

      expect(answer).toEqual({
        ok: false,
        reason: 'UNSUPPORTED_VENDOR',
        error: "vendor 'mimosa'"
      });
      expect(fetchConfig).not.toHaveBeenCalled();
    });
  });

  describe('setHostname', () => {
    it('should write the name from this server', async () => {
      writer.setHostname.mockResolvedValue(Result.ok());

      const answer = await gateway.setHostname(
        { by: 'server' },
        makeTarget(),
        'AP Sur'
      );

      expect(answer).toEqual({ ok: true, value: undefined });
      expect(writer.setHostname).toHaveBeenCalledWith(
        '10.0.0.5',
        makeTarget().login,
        'AP Sur'
      );
    });

    it('should call a failed write a radio failure', async () => {
      writer.setHostname.mockResolvedValue(
        Result.fail('SSH login rejected')
      );

      const answer = await gateway.setHostname(
        { by: 'server' },
        makeTarget(),
        'AP Sur'
      );

      expect(answer).toEqual({
        ok: false,
        reason: 'RADIO',
        error: 'SSH login rejected'
      });
    });

    it('should ask the agent the radio sits behind', async () => {
      agents.setHostname.mockResolvedValue({
        ok: true,
        value: undefined
      });

      const answer = await gateway.setHostname(
        { by: 'agent', agentId: 'agent-1' },
        makeTarget(),
        'AP Sur'
      );

      expect(answer.ok).toBe(true);
      expect(agents.setHostname).toHaveBeenCalledWith(
        'agent-1',
        makeTarget(),
        'AP Sur'
      );
      expect(writer.setHostname).not.toHaveBeenCalled();
    });

    it('[WLS-222] should refuse a vendor with no writer, even through an agent', async () => {
      const answer = await gateway.setHostname(
        { by: 'agent', agentId: 'agent-1' },
        makeTarget({ vendor: 'mimosa' }),
        'AP Sur'
      );

      expect(answer).toMatchObject({
        ok: false,
        reason: 'UNSUPPORTED_VENDOR'
      });
      expect(agents.setHostname).not.toHaveBeenCalled();
    });
  });
});
