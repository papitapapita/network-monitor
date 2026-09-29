import { promises as fs } from 'fs';
import path from 'path';
import { CredentialStore } from '../../../src/agent/identity/CredentialStore';
import {
  DpapiProtector,
  FilePermissionProtector
} from '../../../src/agent/identity/SecretProtector';
import { tempDir } from '../helpers';

const credentials = {
  backendUrl: 'https://api.example.com',
  token: 'secret-token',
  agentName: 'Torre Norte'
};

describe('CredentialStore', () => {
  let dir: string;
  let remove: () => void;

  beforeEach(() => ({ dir, remove } = tempDir()));
  afterEach(() => remove());

  it('loads nothing before pairing', async () => {
    const store = new CredentialStore(
      dir,
      new FilePermissionProtector()
    );

    expect(await store.load()).toBeNull();
  });

  it('[AGT-060] round-trips the credentials', async () => {
    const store = new CredentialStore(
      dir,
      new FilePermissionProtector()
    );

    await store.save(credentials);

    expect(await store.load()).toEqual(credentials);
  });

  it('[AGT-060] on Linux the token file is readable by its owner only', async () => {
    // Windows ignores POSIX modes; DPAPI protects the token there.
    if (process.platform === 'win32') return;
    const store = new CredentialStore(
      dir,
      new FilePermissionProtector()
    );

    await store.save(credentials);

    const { mode } = await fs.stat(path.join(dir, 'agent.json'));
    expect(mode & 0o777).toBe(0o600);
  });

  it('[AGT-060] on Windows the token is sealed with DPAPI before it is written', async () => {
    const run = jest.fn(async (script: string, stdin: string) =>
      script.includes('::Protect(')
        ? `sealed(${stdin})\r\n`
        : stdin.replace(/^sealed\((.*)\)$/, '$1')
    );
    const store = new CredentialStore(dir, new DpapiProtector(run));

    await store.save(credentials);

    const raw = await fs.readFile(
      path.join(dir, 'agent.json'),
      'utf8'
    );
    expect(raw).not.toContain('"secret-token"');
    expect(JSON.parse(raw)).toMatchObject({
      protection: 'dpapi',
      token: 'sealed(secret-token)'
    });
    expect(await store.load()).toEqual(credentials);
    // The secret travels on stdin, never on the command line.
    for (const [script] of run.mock.calls) {
      expect(script).not.toContain('secret-token');
    }
  });

  it('refuses a token sealed by another platform instead of sending garbage', async () => {
    await new CredentialStore(
      dir,
      new FilePermissionProtector()
    ).save(credentials);
    const store = new CredentialStore(
      dir,
      new DpapiProtector(async () => '')
    );

    await expect(store.load()).rejects.toThrow('file-permissions');
  });

  it('[AGT-066] clear removes the token', async () => {
    const store = new CredentialStore(
      dir,
      new FilePermissionProtector()
    );
    await store.save(credentials);

    await store.clear();

    expect(await store.load()).toBeNull();
  });
});
