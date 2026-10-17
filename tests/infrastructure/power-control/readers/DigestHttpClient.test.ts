// Source: src/infrastructure/power-control/readers/DigestHttpClient.ts

import { createHash } from 'crypto';
import {
  DigestHttpClient,
  HttpGet
} from '../../../../src/infrastructure/power-control/readers';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const LOGIN = { username: 'admin', password: 'secret' };
const URL_ = 'http://10.0.5.3:80/poe.b';

function respond(
  status: number,
  headers: Record<string, string> = {},
  body = ''
) {
  return {
    status,
    header: (name: string) => headers[name.toLowerCase()] ?? null,
    text: async () => body
  };
}

describe('DigestHttpClient', () => {
  it('should answer a qop=auth challenge (RFC 2617)', async () => {
    const get = jest
      .fn<ReturnType<HttpGet>, Parameters<HttpGet>>()
      .mockResolvedValueOnce(
        respond(401, {
          'www-authenticate':
            'Digest realm="CSS106-1G-4P-1S", nonce="abc123", qop="auth"'
        })
      )
      .mockResolvedValueOnce(respond(200, {}, '{en:0x01}'));
    const client = new DigestHttpClient(get, () => 'c0ffee');

    const body = await client.getText(URL_, LOGIN, 1000);

    expect(body).toBe('{en:0x01}');
    const ha1 = md5('admin:CSS106-1G-4P-1S:secret');
    const ha2 = md5('GET:/poe.b');
    const expected = md5(`${ha1}:abc123:00000001:c0ffee:auth:${ha2}`);
    expect(get.mock.calls[1]![1].Authorization).toBe(
      `Digest username="admin", realm="CSS106-1G-4P-1S", nonce="abc123", uri="/poe.b", response="${expected}", qop=auth, nc=00000001, cnonce="c0ffee"`
    );
  });

  it('should answer a challenge without qop', async () => {
    const get = jest
      .fn<ReturnType<HttpGet>, Parameters<HttpGet>>()
      .mockResolvedValueOnce(
        respond(401, {
          'www-authenticate':
            'Digest realm="SwOS", nonce="n1", opaque="o1"'
        })
      )
      .mockResolvedValueOnce(respond(200, {}, 'ok'));
    const client = new DigestHttpClient(get);

    await client.getText(URL_, LOGIN, 1000);

    const ha1 = md5('admin:SwOS:secret');
    const response = md5(`${ha1}:n1:${md5('GET:/poe.b')}`);
    expect(get.mock.calls[1]![1].Authorization).toBe(
      `Digest username="admin", realm="SwOS", nonce="n1", uri="/poe.b", response="${response}", opaque="o1"`
    );
  });

  it('should say when the login is rejected', async () => {
    const get = jest
      .fn<ReturnType<HttpGet>, Parameters<HttpGet>>()
      .mockResolvedValue(
        respond(401, {
          'www-authenticate': 'Digest realm="r", nonce="n"'
        })
      );

    await expect(
      new DigestHttpClient(get).getText(URL_, LOGIN, 1000)
    ).rejects.toThrow('the switch rejected the username or password');
  });

  it('should fail on a status that is not a digest challenge', async () => {
    const get = jest
      .fn<ReturnType<HttpGet>, Parameters<HttpGet>>()
      .mockResolvedValue(respond(404));

    await expect(
      new DigestHttpClient(get).getText(URL_, LOGIN, 1000)
    ).rejects.toThrow(`HTTP 404 from ${URL_}`);
  });

  it('should take a page served without a login as is', async () => {
    const get = jest
      .fn<ReturnType<HttpGet>, Parameters<HttpGet>>()
      .mockResolvedValue(respond(200, {}, 'open'));

    await expect(
      new DigestHttpClient(get).getText(URL_, LOGIN, 1000)
    ).resolves.toBe('open');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
