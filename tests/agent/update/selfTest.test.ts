import {
  agentPlatform,
  selfTest
} from '../../../src/agent/update/selfTest';

describe('selfTest', () => {
  it('[AGT-081] reports the version once the release key loads', () => {
    expect(selfTest('0.2.1')).toBe('0.2.1');
  });

  it.each([
    ['win32', 'x64', 'win-x64'],
    ['linux', 'x64', 'linux-x64'],
    ['linux', 'arm64', null],
    ['win32', 'ia32', null],
    ['darwin', 'x64', null]
  ] as const)(
    '[AGT-082] %s on %s updates as %s',
    (platform, arch, expected) => {
      expect(agentPlatform(platform, arch)).toBe(expected);
    }
  );
});
