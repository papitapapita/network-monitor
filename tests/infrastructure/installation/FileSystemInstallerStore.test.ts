// Source: src/infrastructure/installation/FileSystemInstallerStore.ts

import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSystemInstallerStore } from '../../../src/infrastructure/installation/FileSystemInstallerStore';

async function read(stream: NodeJS.ReadableStream): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

describe('FileSystemInstallerStore', () => {
  let dir: string;
  let store: FileSystemInstallerStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nms-installers-'));
    store = new FileSystemInstallerStore(dir);
    await writeFile(join(dir, 'nms-agent-setup-0.1.0.exe'), 'win');
    await writeFile(
      join(dir, 'nms-agent-0.1.0-linux-x64.tar.gz'),
      'lin'
    );
    await writeFile(join(dir, 'Agent.MSI'), 'msi');
    await writeFile(join(dir, 'README.txt'), 'notes');
    await writeFile(join(dir, '.secret.exe'), 'hidden');
    await mkdir(join(dir, 'old.exe'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('[INS-043] list', () => {
    it('lists only installer files, with their platform and size', async () => {
      const files = (await store.list()).value;

      expect(
        files.map((f) => [f.fileName, f.platform, f.sizeBytes]).sort()
      ).toEqual([
        ['Agent.MSI', 'windows', 3],
        ['nms-agent-0.1.0-linux-x64.tar.gz', 'linux', 3],
        ['nms-agent-setup-0.1.0.exe', 'windows', 3]
      ]);
    });

    it('fails on a folder that does not exist', async () => {
      const result = await new FileSystemInstallerStore(
        join(dir, 'missing')
      ).list();

      expect(result.error).toContain(
        'Installer folder cannot be read'
      );
    });
  });

  describe('[INS-043] open', () => {
    it('streams a listed installer', async () => {
      const opened = (await store.open('nms-agent-setup-0.1.0.exe'))
        .value!;

      expect(opened.file.platform).toBe('windows');
      expect(await read(opened.stream)).toBe('win');
    });

    it.each([
      'README.txt',
      '.secret.exe',
      'old.exe',
      '../nms-agent-setup-0.1.0.exe',
      `${'x'}/../nms-agent-setup-0.1.0.exe`,
      'NMS-AGENT-SETUP-0.1.0.EXE'
    ])('finds nothing for %s', async (name) => {
      expect((await store.open(name)).value).toBeNull();
    });
  });
});
