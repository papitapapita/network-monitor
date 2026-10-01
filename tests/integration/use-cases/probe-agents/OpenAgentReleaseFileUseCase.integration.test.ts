// The use case over the real file-system catalogue: a release written the
// way package.mjs writes one, signed with a key made for the test.

import { createHash, generateKeyPairSync, sign } from 'crypto';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  AGENT_RELEASE_FILE_NOT_FOUND,
  OpenAgentReleaseFileUseCase
} from 'application/probe-agents/use-cases';
import { FileSystemAgentReleaseCatalog } from 'infrastructure/probe-agents/releases';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { releaseSignaturePayload } from 'agent/protocol';

describe('OpenAgentReleaseFileUseCase — integration', () => {
  let dir: string;
  let useCase: OpenAgentReleaseFileUseCase;

  beforeAll(async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    dir = await mkdtemp(join(tmpdir(), 'nms-release-'));
    const binary = 'binary 0.2.1';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    await writeFile(join(dir, 'nms-agent-0.2.1-linux-x64.gz'), 'gz');
    await writeFile(
      join(dir, 'nms-agent-0.2.1.manifest.json'),
      JSON.stringify({
        version: '0.2.1',
        files: {
          'linux-x64': {
            file: 'nms-agent-0.2.1-linux-x64.gz',
            sha256,
            bytes: binary.length,
            signature: sign(
              null,
              Buffer.from(
                releaseSignaturePayload('0.2.1', 'linux-x64', sha256)
              ),
              privateKey
            ).toString('base64')
          }
        }
      })
    );
    const logger = new WinstonLogger();
    useCase = new OpenAgentReleaseFileUseCase(
      new FileSystemAgentReleaseCatalog(
        dir,
        logger,
        publicKey.export({ type: 'spki', format: 'pem' }).toString()
      ),
      logger
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('[AGT-083] opens a binary the signed release lists', async () => {
    const result = await useCase.execute({
      fileName: 'nms-agent-0.2.1-linux-x64.gz'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.bytes).toBe(2);
    (
      result.value.stream as NodeJS.ReadableStream & {
        destroy(): void;
      }
    ).destroy();
  });

  it.each([
    'nms-agent-0.2.1.manifest.json',
    'nms-agent-0.2.2-linux-x64.gz',
    ''
  ])('[AGT-083] answers not found for %p', async (fileName) => {
    const result = await useCase.execute({ fileName });

    expect(result.error).toBe(AGENT_RELEASE_FILE_NOT_FOUND);
  });
});
