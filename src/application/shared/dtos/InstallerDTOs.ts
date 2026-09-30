export type InstallerPlatform = 'windows' | 'linux';

export interface InstallerDTO {
  fileName: string;
  platform: InstallerPlatform;
  // Read from the file name (nms-agent-setup-0.1.0.exe); null when absent.
  version: string | null;
  sizeBytes: number;
  modifiedAt: string;
}

export interface ListInstallersResponseDTO {
  installers: InstallerDTO[];
}

export interface GetInstallerRequestDTO {
  fileName: string;
}

export interface InstallerDownloadDTO {
  installer: InstallerDTO;
  stream: NodeJS.ReadableStream;
}
