import { createReadStream } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { Result } from 'domain/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AgentReleaseDownload,
  IAgentReleaseCatalog
} from 'application/probe-agents/interfaces';
import {
  AGENT_PLATFORMS,
  RELEASE_PUBLIC_KEY,
  ReleaseFile,
  ReleaseManifest,
  isNewerVersion,
  isReleaseVersion,
  releaseFileName,
  verifyReleaseSignature
} from 'agent/protocol';

const MANIFEST_NAME = /^nms-agent-(\d+\.\d+\.\d+)\.manifest\.json$/;
const SHA256 = /^[0-9a-f]{64}$/;

// AGT-082: reads the installer folder on every call, like the installers
// (INS-042), so a release copied in reaches connected agents within their
// next configuration refresh, and one whose binary arrives after its
// manifest is picked up once it does. A manifest that fails any check is
// skipped, and each new reason logged once.
export class FileSystemAgentReleaseCatalog
  implements IAgentReleaseCatalog
{
  private readonly reported = new Map<string, string>();

  constructor(
    private readonly dir: string | null,
    private readonly logger: ILogger,
    private readonly publicKeyPem: string = RELEASE_PUBLIC_KEY
  ) {}

  async latest(): Promise<Result<ReleaseManifest | null>> {
    const all = await this.valid();
    if (all.isFailure) return Result.fail(all.error);
    let newest: ReleaseManifest | null = null;
    for (const manifest of all.value) {
      if (
        !newest ||
        isNewerVersion(manifest.version, newest.version)
      ) {
        newest = manifest;
      }
    }
    return Result.ok(newest);
  }

  async open(
    fileName: string
  ): Promise<Result<AgentReleaseDownload | null>> {
    const all = await this.valid();
    if (all.isFailure) return Result.fail(all.error);
    const listed = all.value.some((manifest) =>
      Object.values(manifest.files).some((f) => f?.file === fileName)
    );
    if (!listed || this.dir === null) return Result.ok(null);
    try {
      const path = join(this.dir, fileName);
      const info = await stat(path);
      return Result.ok({
        bytes: info.size,
        stream: createReadStream(path)
      });
    } catch (error) {
      return Result.fail(
        `Release file cannot be read: ${(error as Error).message}`
      );
    }
  }

  private async valid(): Promise<Result<ReleaseManifest[]>> {
    if (this.dir === null) return Result.ok([]);
    let names: string[];
    try {
      names = (await readdir(this.dir, { withFileTypes: true }))
        .filter((e) => e.isFile() && MANIFEST_NAME.test(e.name))
        .map((e) => e.name);
    } catch (error) {
      return Result.fail(
        `Installer folder cannot be read: ${(error as Error).message}`
      );
    }

    const manifests: ReleaseManifest[] = [];
    for (const name of names) {
      const manifest = await this.check(name);
      if (manifest) manifests.push(manifest);
    }
    return Result.ok(manifests);
  }

  private async check(name: string): Promise<ReleaseManifest | null> {
    const problem = await this.problemWith(
      name,
      join(this.dir!, name)
    );
    if (typeof problem !== 'string') {
      this.reported.delete(name);
      return problem;
    }
    if (this.reported.get(name) !== problem) {
      this.reported.set(name, problem);
      this.logger.warn('Agent release skipped', {
        manifest: name,
        reason: problem
      });
    }
    return null;
  }

  // The manifest when every check passes, or why not.
  private async problemWith(
    name: string,
    path: string
  ): Promise<ReleaseManifest | string> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      return 'not valid JSON';
    }
    const version = MANIFEST_NAME.exec(name)![1];
    const parsed = raw as { version?: unknown; files?: unknown };
    if (parsed?.version !== version || !isReleaseVersion(version)) {
      return 'its version does not match its file name';
    }
    if (typeof parsed.files !== 'object' || parsed.files === null) {
      return 'it lists no files';
    }

    const files: ReleaseManifest['files'] = {};
    const listed = parsed.files as Record<string, unknown>;
    for (const platform of AGENT_PLATFORMS) {
      if (!(platform in listed)) continue;
      const file = listed[platform] as Partial<ReleaseFile> | null;
      if (
        !file ||
        file.file !== releaseFileName(version, platform) ||
        typeof file.sha256 !== 'string' ||
        !SHA256.test(file.sha256) ||
        !Number.isInteger(file.bytes) ||
        (file.bytes as number) <= 0 ||
        typeof file.signature !== 'string'
      ) {
        return `its ${platform} entry is malformed`;
      }
      if (
        !verifyReleaseSignature(
          version,
          platform,
          file.sha256,
          file.signature,
          this.publicKeyPem
        )
      ) {
        return `the ${platform} signature does not verify`;
      }
      try {
        if (!(await stat(join(this.dir!, file.file))).isFile()) {
          return `${file.file} is not a file`;
        }
      } catch {
        return `${file.file} is missing`;
      }
      files[platform] = {
        file: file.file,
        sha256: file.sha256,
        bytes: file.bytes as number,
        signature: file.signature
      };
    }
    if (Object.keys(files).length === 0) {
      return 'it has a binary for no known platform';
    }
    return { version, files };
  }
}
