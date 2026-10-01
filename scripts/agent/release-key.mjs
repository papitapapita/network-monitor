#!/usr/bin/env node
// Creates the vendor's release key (AGT-080): the Ed25519 key that signs every
// agent update. Agents install only what it signed.
//
//   npm run agent:release-key
//
// The private key is written outside the repository and never leaves this
// machine. Keep a backup somewhere safe: without it no update can be signed,
// and agents in the field would need a manual reinstall to trust a new key.
// The public key it prints goes into src/agent/protocol/release.ts.

import { generateKeyPairSync } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const DEFAULT_RELEASE_KEY = path.join(
  homedir(),
  '.config/nms-agent/release-key.pem'
);

const file = process.env.NMS_AGENT_RELEASE_KEY ?? DEFAULT_RELEASE_KEY;
if (existsSync(file)) {
  process.stderr.write(
    `${file} already exists; refusing to replace the release key.\n`
  );
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
writeFileSync(
  file,
  privateKey.export({ type: 'pkcs8', format: 'pem' }),
  { mode: 0o600 }
);
process.stdout.write(
  `Private key: ${file} (back it up)\n\nPublic key, for src/agent/protocol/release.ts:\n\n` +
    publicKey.export({ type: 'spki', format: 'pem' })
);
