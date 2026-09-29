#!/usr/bin/env node
// Packages the on-site agent (ADR 0002, slice 1.8).
//
//   npm run package:agent                    both targets
//   npm run package:agent -- --target win-x64
//
// Each target is the official Node.js binary of the version running this
// script, with the bundled agent injected as a single executable application
// (SEA). Output in dist/agent/:
//
//   win-x64/        nms-agent.exe, the WinSW service wrapper and its XML
//   nms-agent-setup-<version>.exe   when Inno Setup 6 is installed (Windows,
//                                   or Windows seen from WSL)
//   nms-agent-<version>-linux-x64.tar.gz   binary, systemd unit, install.sh
//
// Downloads are cached in dist/agent/.cache and checked against pinned or
// published SHA-256 sums before use.

import { build } from 'esbuild';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postject from 'postject';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const OUT = path.join(ROOT, 'dist/agent');
const CACHE = path.join(OUT, '.cache');
const PACKAGING = path.join(ROOT, 'packaging/agent');
const NODE_VERSION = process.version;
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

// GitHub publishes no checksum for WinSW; this is the hash of the v2.12.0
// release asset as first downloaded (2026-09-29). A changed file is refused.
const WINSW = {
  url: 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe',
  sha256:
    '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'
};

const TARGETS = ['win-x64', 'linux-x64'];

function agentVersion() {
  const source = readFileSync(
    path.join(ROOT, 'src/agent/version.ts'),
    'utf8'
  );
  const match = source.match(/AGENT_VERSION = '([^']+)'/);
  if (!match)
    throw new Error(
      'AGENT_VERSION not found in src/agent/version.ts'
    );
  return match[1];
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function download(url, file, expectedSha256) {
  const target = path.join(CACHE, file);
  if (!existsSync(target)) {
    log(`  downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`${url}: HTTP ${response.status}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  const actual = sha256(readFileSync(target));
  if (actual !== expectedSha256) {
    rmSync(target);
    throw new Error(
      `${file}: SHA-256 ${actual}, expected ${expectedSha256}`
    );
  }
  return target;
}

let nodeSums;
async function nodeSum(name) {
  if (!nodeSums) {
    const url = `https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`${url}: HTTP ${response.status}`);
    nodeSums = await response.text();
  }
  const line = nodeSums
    .split('\n')
    .find((l) => l.endsWith(`  ${name}`));
  if (!line)
    throw new Error(`${name} not listed for Node ${NODE_VERSION}`);
  return line.split(/\s+/)[0];
}

async function nodeBinary(target) {
  const base = `https://nodejs.org/dist/${NODE_VERSION}`;
  if (target === 'win-x64') {
    const name = 'win-x64/node.exe';
    return download(
      `${base}/${name}`,
      `node-${NODE_VERSION}-win-x64.exe`,
      await nodeSum(name)
    );
  }
  const archive = `node-${NODE_VERSION}-linux-x64.tar.xz`;
  const file = await download(
    `${base}/${archive}`,
    archive,
    await nodeSum(archive)
  );
  const extracted = path.join(
    CACHE,
    `node-${NODE_VERSION}-linux-x64`
  );
  if (!existsSync(path.join(extracted, 'bin/node'))) {
    execFileSync('tar', ['-xJf', file, '-C', CACHE]);
  }
  return path.join(extracted, 'bin/node');
}

async function bundle() {
  log('Bundling src/agent/main.ts');
  const bundlePath = path.join(OUT, 'nms-agent.cjs');
  await build({
    entryPoints: [path.join(ROOT, 'src/agent/main.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: `node${process.versions.node.split('.')[0]}`,
    outfile: bundlePath,
    absWorkingDir: ROOT,
    logLevel: 'warning'
  });
  return bundlePath;
}

// The blob holds the script only — no code cache or snapshot — which is what
// makes one blob valid for binaries of other platforms of the same version.
function seaBlob(bundlePath) {
  const blob = path.join(OUT, 'sea-prep.blob');
  const config = path.join(OUT, 'sea-config.json');
  writeFileSync(
    config,
    JSON.stringify({
      main: bundlePath,
      output: blob,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false
    })
  );
  execFileSync(
    process.execPath,
    ['--experimental-sea-config', config],
    {
      stdio: 'inherit'
    }
  );
  return blob;
}

async function executable(target, blob, dir) {
  const name = target === 'win-x64' ? 'nms-agent.exe' : 'nms-agent';
  const output = path.join(dir, name);
  copyFileSync(await nodeBinary(target), output);
  chmodSync(output, 0o755);
  await postject.inject(output, 'NODE_SEA_BLOB', readFileSync(blob), {
    sentinelFuse: SEA_FUSE,
    overwrite: true
  });
  return output;
}

function findInnoSetup() {
  if (process.env.ISCC) return process.env.ISCC;
  const candidates =
    process.platform === 'win32'
      ? ['C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe']
      : ['/mnt/c/Program Files (x86)/Inno Setup 6/ISCC.exe'];
  return (
    candidates.find((candidate) => existsSync(candidate)) ?? null
  );
}

// Windows paths for ISCC; under WSL, \\wsl.localhost\... from wslpath.
function forWindows(p) {
  if (process.platform === 'win32') return p;
  return execFileSync('wslpath', ['-w', p]).toString().trim();
}

async function packageWindows(blob, version) {
  const dir = path.join(OUT, 'win-x64');
  mkdirSync(dir, { recursive: true });
  await executable('win-x64', blob, dir);
  copyFileSync(
    await download(WINSW.url, 'WinSW-x64-v2.12.0.exe', WINSW.sha256),
    path.join(dir, 'nms-agent-service.exe')
  );
  copyFileSync(
    path.join(PACKAGING, 'windows/nms-agent-service.xml'),
    path.join(dir, 'nms-agent-service.xml')
  );

  const iscc = findInnoSetup();
  if (!iscc) {
    log(
      '  Inno Setup 6 not found: win-x64/ is ready, but no setup.exe. Install' +
        ' Inno Setup 6 on Windows (or set ISCC) and run this again.'
    );
    return;
  }
  execFileSync(
    iscc,
    [
      '/Q',
      `/DAppVersion=${version}`,
      `/DSourceDir=${forWindows(dir)}`,
      forWindows(path.join(PACKAGING, 'windows/nms-agent.iss'))
    ],
    { stdio: 'inherit' }
  );
  log(`  dist/agent/nms-agent-setup-${version}.exe`);
}

async function packageLinux(blob, version) {
  const name = `nms-agent-${version}-linux-x64`;
  const dir = path.join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const binary = await executable('linux-x64', blob, dir);
  for (const file of [
    'nms-agent.service',
    'install.sh',
    'uninstall.sh'
  ]) {
    copyFileSync(
      path.join(PACKAGING, 'linux', file),
      path.join(dir, file)
    );
  }
  chmodSync(path.join(dir, 'install.sh'), 0o755);
  chmodSync(path.join(dir, 'uninstall.sh'), 0o755);

  if (process.platform === 'linux' && process.arch === 'x64') {
    const reported = execFileSync(binary, ['--version'])
      .toString()
      .trim();
    if (reported !== version) {
      throw new Error(
        `Built binary reports ${reported}, expected ${version}`
      );
    }
  }
  execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: OUT });
  log(`  dist/agent/${name}.tar.gz`);
}

async function main() {
  const flag = process.argv.indexOf('--target');
  const targets = flag >= 0 ? [process.argv[flag + 1]] : TARGETS;
  for (const target of targets) {
    if (!TARGETS.includes(target))
      throw new Error(`Unknown target ${target}`);
  }

  const version = agentVersion();
  log(`Agent ${version}, Node ${NODE_VERSION}`);
  mkdirSync(CACHE, { recursive: true });
  const blob = seaBlob(await bundle());

  for (const target of targets) {
    log(`Packaging ${target}`);
    if (target === 'win-x64') await packageWindows(blob, version);
    else await packageLinux(blob, version);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
