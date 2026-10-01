import { createPublicKey, KeyObject, verify } from 'crypto';

// An agent release (AGT-080): one gzipped binary per platform, described by a
// manifest the packaging script writes beside them. Each binary is signed by
// the vendor's release key, whose private half never leaves the vendor's
// machine; an agent installs nothing that key did not sign, whoever offers it.

export type AgentPlatform = 'win-x64' | 'linux-x64';

export const AGENT_PLATFORMS: readonly AgentPlatform[] = [
  'win-x64',
  'linux-x64'
];

// The public half of the vendor's release key (scripts/agent/release-key.mjs).
// Replacing it means every agent in the field needs one manual reinstall.
export const RELEASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAO0o0QHAOih8B5gmGLHFyWwpU0SQmPHFCm2CJGSQA8CQ=
-----END PUBLIC KEY-----
`;

export interface ReleaseFile {
  // The gzipped binary's name in the release folder.
  file: string;
  // SHA-256 of the binary once unzipped, lowercase hex.
  sha256: string;
  // Size of the binary once unzipped, in bytes.
  bytes: number;
  // Ed25519 signature of releaseSignaturePayload(...), base64.
  signature: string;
}

export interface ReleaseManifest {
  version: string;
  files: Partial<Record<AgentPlatform, ReleaseFile>>;
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export function isReleaseVersion(value: string): boolean {
  return VERSION.test(value);
}

// Plain major.minor.patch; anything else is never newer.
export function isNewerVersion(
  candidate: string,
  current: string
): boolean {
  const a = VERSION.exec(candidate);
  const b = VERSION.exec(current);
  if (!a || !b) return false;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export function releaseManifestName(version: string): string {
  return `nms-agent-${version}.manifest.json`;
}

export function releaseFileName(
  version: string,
  platform: AgentPlatform
): string {
  return `nms-agent-${version}-${platform}.gz`;
}

// What the signature covers: the version, the platform and the binary's hash
// together, so a signed binary cannot be offered as another version (a
// downgrade) or to the other platform. scripts/agent/package.mjs builds the
// same string.
export function releaseSignaturePayload(
  version: string,
  platform: AgentPlatform,
  sha256: string
): string {
  return `nms-agent-release:v1:${version}:${platform}:${sha256}`;
}

let defaultKey: KeyObject | null = null;

export function verifyReleaseSignature(
  version: string,
  platform: AgentPlatform,
  sha256: string,
  signature: string,
  publicKeyPem: string = RELEASE_PUBLIC_KEY
): boolean {
  try {
    const key =
      publicKeyPem === RELEASE_PUBLIC_KEY
        ? (defaultKey ??= createPublicKey(RELEASE_PUBLIC_KEY))
        : createPublicKey(publicKeyPem);
    return verify(
      null,
      Buffer.from(
        releaseSignaturePayload(version, platform, sha256),
        'utf8'
      ),
      key,
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}
