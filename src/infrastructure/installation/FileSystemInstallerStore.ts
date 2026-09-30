import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Result } from 'domain/shared/core';
import {
  IInstallerStore,
  InstallerFile
} from 'application/shared/interfaces';
import { InstallerPlatform } from 'application/shared/dtos';

const PLATFORMS: [suffix: string, platform: InstallerPlatform][] = [
  ['.exe', 'windows'],
  ['.msi', 'windows'],
  ['.tar.gz', 'linux']
];

function platformOf(fileName: string): InstallerPlatform | null {
  const lower = fileName.toLowerCase();
  if (lower.startsWith('.')) return null;
  return (
    PLATFORMS.find(([suffix]) => lower.endsWith(suffix))?.[1] ?? null
  );
}

// Reads the folder on every call, so an installer dropped in is offered at
// once, with no restart. A requested name is only ever matched against the
// folder's own listing, never joined onto the path as given.
export class FileSystemInstallerStore implements IInstallerStore {
  constructor(private readonly dir: string) {}

  public async list(): Promise<Result<InstallerFile[]>> {
    try {
      const entries = await readdir(this.dir, {
        withFileTypes: true
      });
      const files: InstallerFile[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const platform = platformOf(entry.name);
        if (!platform) continue;
        const info = await stat(join(this.dir, entry.name));
        files.push({
          fileName: entry.name,
          platform,
          sizeBytes: info.size,
          modifiedAt: info.mtime
        });
      }
      return Result.ok(files);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      return Result.fail(`Installer folder cannot be read: ${msg}`);
    }
  }

  public async open(
    fileName: string
  ): Promise<
    Result<{
      file: InstallerFile;
      stream: NodeJS.ReadableStream;
    } | null>
  > {
    const listed = await this.list();
    if (listed.isFailure) return Result.fail(listed.error!);

    const file = listed.value.find((f) => f.fileName === fileName);
    if (!file) return Result.ok(null);

    return Result.ok({
      file,
      stream: createReadStream(join(this.dir, file.fileName))
    });
  }
}
