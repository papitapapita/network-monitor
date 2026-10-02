import { chmodSync, writeFileSync } from 'fs';
import path from 'path';
import {
  agentPlatform,
  runSelfTest,
  selfTest
} from '../../../src/agent/update/selfTest';
import { tempDir } from '../helpers';

const posix = process.platform === 'win32' ? describe.skip : describe;

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

  posix('runSelfTest', () => {
    let dir: string;
    let remove: () => void;

    const binary = (script: string) => {
      const file = path.join(dir, 'nms-agent.new');
      writeFileSync(file, `#!/bin/sh\n${script}\n`);
      chmodSync(file, 0o755);
      return file;
    };

    beforeEach(() => ({ dir, remove } = tempDir()));
    afterEach(() => remove());

    it('[AGT-081] resolves to the version the binary printed', async () => {
      await expect(runSelfTest(binary('echo 0.2.1'))).resolves.toBe(
        '0.2.1'
      );
    });

    it('[AGT-081] gives the binary’s own last word as the reason it failed', async () => {
      await expect(
        runSelfTest(
          binary(
            'echo loading >&2; echo "release key unreadable" >&2; exit 1'
          )
        )
      ).rejects.toThrow(/^release key unreadable$/);
    });

    it('[AGT-081] falls back to the exit code when the binary says nothing', async () => {
      await expect(runSelfTest(binary('exit 3'))).rejects.toThrow(
        /^exit code 3$/
      );
    });
  });
});
