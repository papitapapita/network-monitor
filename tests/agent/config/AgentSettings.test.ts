import { loadAgentSettings } from '../../../src/agent/config/AgentSettings';

describe('loadAgentSettings', () => {
  it('keeps its data under ProgramData on Windows', () => {
    const settings = loadAgentSettings(
      { ProgramData: 'D:\\ProgramData' },
      [],
      'win32'
    );

    expect(settings.dataDir).toBe('D:\\ProgramData\\NmsAgent');
  });

  it('keeps its data under /var/lib on Linux', () => {
    expect(loadAgentSettings({}, [], 'linux').dataDir).toBe(
      '/var/lib/nms-agent'
    );
  });

  it('honours an explicit data directory', () => {
    expect(
      loadAgentSettings(
        { NMS_AGENT_DATA_DIR: '/tmp/agent' },
        [],
        'linux'
      ).dataDir
    ).toBe('/tmp/agent');
  });

  it('takes a pairing key from --pair before the environment', () => {
    const settings = loadAgentSettings(
      { NMS_AGENT_PAIRING_KEY: 'pk1.env.key' },
      ['--pair', ' pk1.arg.key '],
      'linux'
    );

    expect(settings.pairingKey).toBe('pk1.arg.key');
  });

  it('has no pairing key unless one is given', () => {
    expect(loadAgentSettings({}, [], 'linux').pairingKey).toBeNull();
  });
});
