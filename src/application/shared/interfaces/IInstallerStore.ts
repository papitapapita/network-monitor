import { Result } from 'domain/shared/core';
import { InstallerPlatform } from '../dtos/InstallerDTOs';

export const INSTALLERS_UNAVAILABLE =
  'Installer downloads are not configured on this install';

export interface InstallerFile {
  fileName: string;
  platform: InstallerPlatform;
  sizeBytes: number;
  modifiedAt: Date;
}

// The folder the vendor drops agent installers into. Only installer files are
// visible through it; everything else in the folder stays out of reach.
export interface IInstallerStore {
  list(): Promise<Result<InstallerFile[]>>;
  // null when no listed installer has exactly this name.
  open(
    fileName: string
  ): Promise<
    Result<{
      file: InstallerFile;
      stream: NodeJS.ReadableStream;
    } | null>
  >;
}
