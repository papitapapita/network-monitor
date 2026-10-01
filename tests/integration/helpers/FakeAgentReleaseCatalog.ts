import { Readable } from 'stream';
import { Result } from '../../../src/domain/shared/core/Result';
import {
  AgentReleaseDownload,
  IAgentReleaseCatalog
} from '../../../src/application/probe-agents/interfaces';
import { ReleaseManifest } from '../../../src/agent/protocol';

// The release the install offers, set by the test; no folder, no
// signatures (those are FileSystemAgentReleaseCatalog's to check).
export class FakeAgentReleaseCatalog implements IAgentReleaseCatalog {
  release: ReleaseManifest | null = null;
  contents = new Map<string, string>();

  async latest(): Promise<Result<ReleaseManifest | null>> {
    return Result.ok(this.release);
  }

  async open(
    fileName: string
  ): Promise<Result<AgentReleaseDownload | null>> {
    const body = this.contents.get(fileName);
    if (body === undefined) return Result.ok(null);
    return Result.ok({
      bytes: Buffer.byteLength(body),
      stream: Readable.from([Buffer.from(body)])
    });
  }

  publish(version: string, platform: 'win-x64' | 'linux-x64'): void {
    const file = `nms-agent-${version}-${platform}.gz`;
    this.release = {
      version,
      files: {
        [platform]: {
          file,
          sha256: 'a'.repeat(64),
          bytes: 1000,
          signature: 'c2lnbmF0dXJl'
        }
      }
    };
    this.contents.set(file, `binary ${version}`);
  }
}
