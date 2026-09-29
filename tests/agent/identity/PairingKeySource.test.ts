import { promises as fs } from 'fs';
import path from 'path';
import { PairingKeySource } from '../../../src/agent/identity/PairingKeySource';
import { tempDir } from '../helpers';

describe('PairingKeySource', () => {
  let dir: string;
  let remove: () => void;

  beforeEach(() => ({ dir, remove } = tempDir()));
  afterEach(() => remove());

  it('has nothing until a key is given', async () => {
    expect(await new PairingKeySource(dir, null).read()).toBeNull();
  });

  it('[AGT-060] reads the key the installer left, trimmed', async () => {
    await fs.writeFile(
      path.join(dir, 'pairing.key'),
      '  pk1.abc.def\r\n'
    );

    expect(await new PairingKeySource(dir, null).read()).toBe(
      'pk1.abc.def'
    );
  });

  it('a key given at start-up wins over the file', async () => {
    await fs.writeFile(path.join(dir, 'pairing.key'), 'pk1.file.key');

    expect(
      await new PairingKeySource(dir, 'pk1.given.key').read()
    ).toBe('pk1.given.key');
  });

  it('[AGT-060] a used key is gone, from memory and disk', async () => {
    await fs.writeFile(path.join(dir, 'pairing.key'), 'pk1.file.key');
    const source = new PairingKeySource(dir, 'pk1.given.key');

    await source.discard();

    expect(await source.read()).toBeNull();
  });
});
