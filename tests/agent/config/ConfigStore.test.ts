import { promises as fs } from 'fs';
import path from 'path';
import { ConfigStore } from '../../../src/agent/config/ConfigStore';
import { tempDir } from '../helpers';

describe('ConfigStore', () => {
  let dir: string;
  let remove: () => void;

  beforeEach(() => ({ dir, remove } = tempDir()));
  afterEach(() => remove());

  const device = {
    d: 1,
    ip: '10.0.0.1',
    intervalSeconds: 60,
    failuresBeforeDown: 3
  };

  it('[AGT-062] keeps the last configuration across a restart', async () => {
    await new ConfigStore(dir).save({
      version: 'v1',
      devices: [device]
    });

    expect(await new ConfigStore(dir).load()).toEqual({
      version: 'v1',
      devices: [device]
    });
  });

  it('[AGT-062] writes only addresses and intervals, never anything else a device carries', async () => {
    await new ConfigStore(dir).save({
      version: 'v1',
      devices: [{ ...device, password: 'hunter2' } as typeof device]
    });

    const raw = await fs.readFile(
      path.join(dir, 'config.json'),
      'utf8'
    );
    expect(raw).not.toContain('hunter2');
  });

  it('treats an unreadable file as no configuration', async () => {
    await fs.writeFile(path.join(dir, 'config.json'), '{not json');

    expect(await new ConfigStore(dir).load()).toBeNull();
  });

  it('[AGT-066] clear removes it', async () => {
    const store = new ConfigStore(dir);
    await store.save({ version: 'v1', devices: [device] });

    await store.clear();

    expect(await store.load()).toBeNull();
  });
});
