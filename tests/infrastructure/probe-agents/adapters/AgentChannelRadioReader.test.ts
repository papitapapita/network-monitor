import { AgentChannelRadioReader } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelRadioReader';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { AgentRadioReadRequest } from '../../../../src/application/wireless-monitoring/interfaces';
import { makeWirelessCollectionResult } from '../../../fixtures/wirelessCollection';

describe('AgentChannelRadioReader', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const reader = new AgentChannelRadioReader(channel);
  const request: AgentRadioReadRequest = {
    ipAddress: '10.0.0.10',
    vendor: 'ubiquiti',
    deviceType: 'ACCESS_POINT',
    credentials: {
      snmpVersion: 2,
      snmpCommunity: 'public',
      snmpV3AuthUser: null,
      snmpV3AuthProto: null,
      snmpV3AuthKey: null,
      snmpV3PrivProto: null,
      snmpV3PrivKey: null,
      httpUsername: 'ubnt',
      httpPassword: 'secreto',
      snmpPort: 161,
      httpPort: 443
    }
  };

  it('[WLS-029] passes the agent’s reading on with its time', async () => {
    const measuredAt = new Date();
    const reading = makeWirelessCollectionResult();
    channel.readRadio.mockResolvedValue({
      ok: true,
      reading,
      measuredAt
    });

    await expect(reader.read('a-1', request)).resolves.toEqual({
      kind: 'measured',
      reading,
      measuredAt
    });
    expect(channel.readRadio).toHaveBeenCalledWith('a-1', request);
  });

  it('[WLS-029] passes on why the agent could not read the radio', async () => {
    channel.readRadio.mockResolvedValue({
      ok: false,
      reason: 'TIMEOUT',
      error: 'The agent did not answer in time'
    });

    await expect(reader.read('a-1', request)).resolves.toEqual({
      kind: 'refused',
      reason: 'TIMEOUT',
      error: 'The agent did not answer in time'
    });
  });
});
