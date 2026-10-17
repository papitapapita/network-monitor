// Source: src/infrastructure/power-control/readers/SwOsPoeReader.ts

import {
  DigestHttpClient,
  SwOsPoeReader,
  swOsHttpPort
} from '../../../../src/infrastructure/power-control/readers';
import { PoeSwitchConnection } from '../../../../src/application/power-control/interfaces';

const hex = (s: string) => Buffer.from(s, 'latin1').toString('hex');

const CONNECTION: PoeSwitchConnection = {
  host: '10.0.5.3',
  firmware: 'SWOS',
  login: {
    username: 'admin',
    password: 'secret',
    apiPort: 8728,
    httpPort: 443
  }
};

// Built from the field names the reader expects (PWR-024); to be replaced by
// a capture from the real CSS106 at the phase 1 hardware check.
const FILES: Record<string, string> = {
  'link.b': `{en:0x3f,nm:['${hex('Port1')}','${hex('10.0.5.21')}','${hex('Rocket sur')}','','${hex('10.0.5.23')}','${hex('SFP')}']}`,
  'poe.b':
    '{poe:[0x01,0x01,0x00,0x01,0x02],poes:[0x02,0x02,0x00,0x01,0x04],pwr:[0x00,0x3d,0x00,0x00,0x00],vlt:[0xf1,0xf1,0x00,0x00,0x00]}',
  'sys.b': `{ver:'${hex('2.13')}'}`
};

function makeReader(files: Record<string, string> = FILES) {
  const urls: string[] = [];
  const http = {
    getText: async (url: string) => {
      urls.push(url);
      const file = url.split('/').pop()!;
      if (!(file in files)) throw new Error(`HTTP 404 from ${url}`);
      return files[file]!;
    }
  } as unknown as DigestHttpClient;
  return { reader: new SwOsPoeReader(undefined, http), urls };
}

describe('SwOsPoeReader', () => {
  it('[PWR-020] [PWR-024] should read each port with its name, mode, status and power', async () => {
    const { reader } = makeReader();

    const result = await reader.read(CONNECTION);

    expect(result.value).toEqual({
      firmwareVersion: '2.13',
      ports: [
        {
          port: 'Port1',
          label: 'Port1',
          mode: 'AUTO',
          status: 'POWERED',
          powerWatts: 0,
          voltage: 24.1
        },
        {
          port: 'Port2',
          label: '10.0.5.21',
          mode: 'AUTO',
          status: 'POWERED',
          powerWatts: 6.1,
          voltage: 24.1
        },
        {
          port: 'Port3',
          label: 'Rocket sur',
          mode: 'OFF',
          status: 'OFF',
          powerWatts: 0,
          voltage: 0
        },
        {
          port: 'Port4',
          label: 'Port4',
          mode: 'AUTO',
          status: 'NO_LOAD',
          powerWatts: 0,
          voltage: 0
        },
        {
          port: 'Port5',
          label: '10.0.5.23',
          mode: 'FORCED_ON',
          status: 'FAULT',
          powerWatts: 0,
          voltage: 0
        }
      ]
    });
  });

  it('[PWR-012] should use port 80 when the saved HTTP port is the 443 default', async () => {
    const { reader, urls } = makeReader();

    await reader.read(CONNECTION);

    expect(urls[0]).toBe('http://10.0.5.3:80/link.b');
  });

  it('[PWR-012] should keep any other saved HTTP port', () => {
    expect(swOsHttpPort(8080)).toBe(8080);
    expect(swOsHttpPort(443)).toBe(80);
  });

  it('should still read the ports when the version file is missing', async () => {
    const { 'sys.b': _, ...files } = FILES;
    const { reader } = makeReader(files);

    const result = await reader.read(CONNECTION);

    expect(result.value.firmwareVersion).toBeNull();
    expect(result.value.ports).toHaveLength(5);
  });

  it('should fail when the PoE page cannot be read', async () => {
    const { 'poe.b': _, ...files } = FILES;
    const { reader } = makeReader(files);

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe(
      'SwOS error: HTTP 404 from http://10.0.5.3:80/poe.b'
    );
  });

  it('should fail on a page that is not a .b file', async () => {
    const { reader } = makeReader({
      ...FILES,
      'poe.b': '<html></html>'
    });

    const result = await reader.read(CONNECTION);

    expect(result.error).toMatch(/^SwOS error: /);
  });
});
