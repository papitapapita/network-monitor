import { createHash, randomBytes } from 'crypto';

export interface DigestLogin {
  username: string;
  password: string;
}

export type HttpGet = (
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
) => Promise<{
  status: number;
  header(name: string): string | null;
  text(): Promise<string>;
}>;

// SwOS answers every page with a digest challenge (RFC 2617, MD5); each GET
// is sent once bare to get the nonce, then again with the answer.
export class DigestHttpClient {
  constructor(
    private readonly get: HttpGet = fetchGet,
    private readonly cnonce: () => string = () =>
      randomBytes(8).toString('hex')
  ) {}

  async getText(
    url: string,
    login: DigestLogin,
    timeoutMs: number
  ): Promise<string> {
    const first = await this.get(url, {}, timeoutMs);
    if (first.status === 200) return first.text();
    const challenge = first.header('www-authenticate');
    if (first.status !== 401 || !challenge?.startsWith('Digest ')) {
      throw new Error(`HTTP ${first.status} from ${url}`);
    }

    const authorization = this.answer(
      parseChallenge(challenge),
      new URL(url).pathname,
      login
    );
    const second = await this.get(
      url,
      { Authorization: authorization },
      timeoutMs
    );
    if (second.status === 401) {
      throw new Error('the switch rejected the username or password');
    }
    if (second.status !== 200) {
      throw new Error(`HTTP ${second.status} from ${url}`);
    }
    return second.text();
  }

  private answer(
    challenge: Record<string, string>,
    uri: string,
    login: DigestLogin
  ): string {
    const realm = challenge.realm ?? '';
    const nonce = challenge.nonce ?? '';
    const ha1 = md5(`${login.username}:${realm}:${login.password}`);
    const ha2 = md5(`GET:${uri}`);
    const qop = challenge.qop
      ?.split(',')
      .map((q) => q.trim())
      .includes('auth')
      ? 'auth'
      : null;

    const fields: Record<string, string> = {
      username: login.username,
      realm,
      nonce,
      uri
    };
    if (qop) {
      const nc = '00000001';
      const cnonce = this.cnonce();
      fields.response = md5(
        `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`
      );
      Object.assign(fields, { qop, nc, cnonce });
    } else {
      fields.response = md5(`${ha1}:${nonce}:${ha2}`);
    }
    if (challenge.opaque) fields.opaque = challenge.opaque;

    const unquoted = new Set(['qop', 'nc']);
    return (
      'Digest ' +
      Object.entries(fields)
        .map(([k, v]) =>
          unquoted.has(k) ? `${k}=${v}` : `${k}="${v}"`
        )
        .join(', ')
    );
  }
}

function parseChallenge(header: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [, key, quoted, bare] of header
    .slice('Digest '.length)
    .matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) {
    fields[key!.toLowerCase()] = quoted ?? bare ?? '';
  }
  return fields;
}

function md5(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

const fetchGet: HttpGet = async (url, headers, timeoutMs) => {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return {
    status: response.status,
    header: (name) => response.headers.get(name),
    text: () => response.text()
  };
};
