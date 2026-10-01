import { Result } from 'domain/shared/core';
import { ReleaseManifest } from 'agent/protocol';

export interface AgentReleaseDownload {
  bytes: number;
  stream: NodeJS.ReadableStream;
}

// The agent releases the vendor published to this install (AGT-082): the
// manifests in the installer folder whose every signature verifies.
export interface IAgentReleaseCatalog {
  // The newest valid release, or null when there is none.
  latest(): Promise<Result<ReleaseManifest | null>>;
  // A binary named by a valid manifest; null for any other name.
  open(
    fileName: string
  ): Promise<Result<AgentReleaseDownload | null>>;
}
