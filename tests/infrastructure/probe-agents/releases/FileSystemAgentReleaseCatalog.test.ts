// Source: src/infrastructure/probe-agents/releases/FileSystemAgentReleaseCatalog.ts

import { createHash, generateKeyPairSync, sign } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileSystemAgentReleaseCatalog } from '../../../../src/infrastructure/probe-agents/releases';
import {
  AgentPlatform,
  releaseSignaturePayload
} from '../../../../src/agent/protocol';
import { ILogger } from '../../../../src/application/shared/interfaces';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PUBLIC_PEM = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const stranger = generateKeyPairSync('ed25519').privateKey;

async function read(stream: NodeJS.ReadableStream): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

describe('FileSystemAgentReleaseCatalog', () => {
  let dir: string;
  let logger: jest.Mocked<ILogger>;
  let catalog: FileSystemAgentReleaseCatalog;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nms-releases-'));
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn()
    } as unknown as jest.Mocked<ILogger>;
    catalog = new FileSystemAgentReleaseCatalog(
      dir,
      logger,
      PUBLIC_PEM
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // Writes a release the way package.mjs does; `tamper` edits the manifest
  // before it is written.
  async function release(
    version: string,
    {
      platforms = ['linux-x64', 'win-x64'] as AgentPlatform[],
      key = privateKey,
      writeBinaries = true,
      tamper = (m: Record<string, unknown>) => m
    } = {}
  ) {
    const files: Record<string, unknown> = {};
    for (const platform of platforms) {
      const binary = `binary ${version} ${platform}`;
      const sha256 = createHash('sha256')
        .update(binary)
        .digest('hex');
      const file = `nms-agent-${version}-${platform}.gz`;
      if (writeBinaries)
        await writeFile(join(dir, file), `gz:${binary}`);
      files[platform] = {
        file,
        sha256,
        bytes: binary.length,
        signature: sign(
          null,
          Buffer.from(
            releaseSignaturePayload(version, platform, sha256)
          ),
          key
        ).toString('base64')
      };
    }
    await writeFile(
      join(dir, `nms-agent-${version}.manifest.json`),
      JSON.stringify(tamper({ version, files }))
    );
  }

  describe('[AGT-082] latest', () => {
    it('returns the newest valid release', async () => {
      await release('0.2.0');
      await release('0.10.0');
      await release('0.9.3');

      const latest = (await catalog.latest()).value;

      expect(latest?.version).toBe('0.10.0');
      expect(Object.keys(latest!.files).sort()).toEqual([
        'linux-x64',
        'win-x64'
      ]);
    });

    it('is null with no folder or no release', async () => {
      expect((await catalog.latest()).value).toBeNull();
      expect(
        (
          await new FileSystemAgentReleaseCatalog(
            null,
            logger
          ).latest()
        ).value
      ).toBeNull();
    });

    it.each([
      ['signed by another key', { key: stranger }],
      ['whose binary is missing', { writeBinaries: false }],
      [
        'whose version differs from its file name',
        {
          tamper: (m: Record<string, unknown>) => ({
            ...m,
            version: '9.9.9'
          })
        }
      ],
      [
        'with a binary under the wrong name',
        {
          tamper: (m: Record<string, unknown>) => {
            const files = m.files as Record<string, { file: string }>;
            files['linux-x64'].file = 'other.gz';
            return m;
          }
        }
      ]
    ])(
      'skips a release %s, and keeps the older valid one',
      async (_label, options) => {
        await release('0.2.0');
        await release('0.3.0', options);

        expect((await catalog.latest()).value?.version).toBe('0.2.0');
        expect(logger.warn).toHaveBeenCalledWith(
          'Agent release skipped',
          expect.objectContaining({
            manifest: 'nms-agent-0.3.0.manifest.json'
          })
        );
      }
    );

    it('skips a manifest that is not JSON', async () => {
      await writeFile(
        join(dir, 'nms-agent-0.3.0.manifest.json'),
        '{'
      );

      expect((await catalog.latest()).value).toBeNull();
    });

    it('logs a skipped release once, and offers it as soon as its binary arrives', async () => {
      await release('0.3.0', {
        platforms: ['linux-x64'],
        writeBinaries: false
      });

      await catalog.latest();
      await catalog.latest();
      expect(logger.warn).toHaveBeenCalledTimes(1);

      await release('0.3.0', { platforms: ['linux-x64'] });
      expect((await catalog.latest()).value?.version).toBe('0.3.0');
    });

    it('ignores a platform it does not know, keeping the ones it does', async () => {
      await release('0.3.0', {
        platforms: ['linux-x64'],
        tamper: (m) => ({
          ...m,
          files: {
            ...(m.files as object),
            'mac-arm64': { file: 'x' }
          }
        })
      });

      const latest = (await catalog.latest()).value;
      expect(Object.keys(latest!.files)).toEqual(['linux-x64']);
    });
  });

  describe('[AGT-083] open', () => {
    it('streams a binary a valid release lists, with its size on disk', async () => {
      await release('0.2.0');

      const opened = (
        await catalog.open('nms-agent-0.2.0-win-x64.gz')
      ).value;

      expect(await read(opened!.stream)).toBe(
        'gz:binary 0.2.0 win-x64'
      );
      expect(opened!.bytes).toBe('gz:binary 0.2.0 win-x64'.length);
    });

    it('opens nothing a valid release does not list', async () => {
      await release('0.2.0');
      await release('0.3.0', { key: stranger });
      await writeFile(
        join(dir, 'nms-agent-setup-0.2.0.exe'),
        'installer'
      );

      for (const name of [
        'nms-agent-0.3.0-linux-x64.gz',
        'nms-agent-setup-0.2.0.exe',
        'nms-agent-0.2.0.manifest.json',
        '../etc/passwd'
      ]) {
        expect((await catalog.open(name)).value).toBeNull();
      }
    });
  });
});
