// Checks a packaged agent release before it is published (AGT-080):
//
//   npx tsx scripts/agent/verify-release.ts <dir> <version>
//
// Every platform must be in the manifest, and each binary must unzip to the
// size and SHA-256 the manifest lists, under a signature the agents' own
// public key accepts. Uses the agents' code for the check, so a release that
// passes here is one they will install.

import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import {
  AGENT_PLATFORMS,
  ReleaseManifest,
  releaseFileName,
  releaseManifestName,
  verifyReleaseSignature
} from '../../src/agent/protocol/release';

function check(dir: string, version: string): string[] {
  const problems: string[] = [];
  const manifestPath = path.join(dir, releaseManifestName(version));
  if (!existsSync(manifestPath)) {
    return [`${releaseManifestName(version)} not found in ${dir}`];
  }
  const manifest = JSON.parse(
    readFileSync(manifestPath, 'utf8')
  ) as ReleaseManifest;
  if (manifest.version !== version) {
    problems.push(
      `the manifest says ${manifest.version}, expected ${version}`
    );
  }
  for (const platform of AGENT_PLATFORMS) {
    const entry = manifest.files[platform];
    if (!entry) {
      problems.push(`${platform}: missing from the manifest`);
      continue;
    }
    if (entry.file !== releaseFileName(version, platform)) {
      problems.push(
        `${platform}: unexpected file name ${entry.file}`
      );
      continue;
    }
    const gz = path.join(dir, entry.file);
    if (!existsSync(gz)) {
      problems.push(`${platform}: ${entry.file} not found`);
      continue;
    }
    const binary = gunzipSync(readFileSync(gz));
    const sha256 = createHash('sha256').update(binary).digest('hex');
    if (binary.length !== entry.bytes) {
      problems.push(`${platform}: size does not match the manifest`);
    }
    if (sha256 !== entry.sha256) {
      problems.push(
        `${platform}: SHA-256 does not match the manifest`
      );
    }
    if (
      !verifyReleaseSignature(
        version,
        platform,
        sha256,
        entry.signature
      )
    ) {
      problems.push(
        `${platform}: signature not accepted by the agents' public key`
      );
    }
  }
  return problems;
}

const [dir, version] = process.argv.slice(2);
if (!dir || !version) {
  process.stderr.write('usage: verify-release.ts <dir> <version>\n');
  process.exit(2);
}
const problems = check(dir, version);
if (problems.length > 0) {
  process.stderr.write(
    `Release ${version} failed its checks:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`
  );
  process.exit(1);
}
process.stdout.write(
  `Release ${version} verified: ${AGENT_PLATFORMS.join(', ')}\n`
);
