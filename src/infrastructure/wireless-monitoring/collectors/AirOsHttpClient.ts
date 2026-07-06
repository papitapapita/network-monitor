import * as https from 'https';
import { IncomingHttpHeaders } from 'http';
import { Result } from 'domain/shared/core';
import { ILogger } from 'application/shared/interfaces';

interface HttpsResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

interface AirOsCredentials {
  username: string;
  password: string;
}

export class AirOsHttpClient {
  private readonly timeoutMs: number;
  private readonly sessions = new Map<string, string>();

  constructor(
    timeoutMs = 10_000,
    private readonly logger?: ILogger
  ) {
    this.timeoutMs = timeoutMs;
  }

  async fetchStatus(
    ip: string,
    port: number,
    creds: AirOsCredentials
  ): Promise<Result<unknown>> {
    let cookie = this.sessions.get(ip);
    if (!cookie) {
      const authResult = await this.authenticate(ip, port, creds);
      if (authResult.isFailure) return Result.fail(authResult.error!);
      cookie = authResult.value;
    }

    const getResult = await this.doGet(ip, port, '/status.cgi', cookie);
    if (getResult.isFailure) return Result.fail(getResult.error!);

    if (this.isSessionExpired(getResult.value.statusCode)) {
      this.sessions.delete(ip);
      const reAuthResult = await this.authenticate(ip, port, creds);
      if (reAuthResult.isFailure) return Result.fail(reAuthResult.error!);
      const retryResult = await this.doGet(ip, port, '/status.cgi', reAuthResult.value);
      if (retryResult.isFailure) return Result.fail(retryResult.error!);
      if (retryResult.value.statusCode !== 200) {
        return Result.fail(
          `status.cgi returned HTTP ${retryResult.value.statusCode} after re-auth`
        );
      }
      return this.parseJson(retryResult.value.body);
    }

    if (getResult.value.statusCode !== 200) {
      return Result.fail(
        `status.cgi returned HTTP ${getResult.value.statusCode}`
      );
    }
    return this.parseJson(getResult.value.body);
  }

  private isSessionExpired(statusCode: number): boolean {
    return statusCode === 401 || statusCode === 302;
  }

  private async authenticate(
    ip: string,
    port: number,
    creds: AirOsCredentials
  ): Promise<Result<string>> {
    const body =
      `username=${encodeURIComponent(creds.username)}` +
      `&password=${encodeURIComponent(creds.password)}`;

    const result = await this.httpsRequest(
      {
        hostname: ip,
        port,
        path: '/api/auth',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      body
    );
    if (result.isFailure) return Result.fail(result.error!);

    const { statusCode, headers } = result.value;
    if (statusCode !== 200 && statusCode !== 201) {
      return Result.fail(`Authentication failed: HTTP ${statusCode}`);
    }

    const rawCookies = headers['set-cookie'] ?? [];
    const cookieList = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    const airOsCookie = cookieList
      .map((h) => h.split(';')[0]?.trim())
      .find((s) => s !== undefined && /^AIROS_[0-9A-Fa-f]+=/.test(s));

    if (!airOsCookie) {
      return Result.fail(
        'No AIROS session cookie in authentication response'
      );
    }

    this.sessions.set(ip, airOsCookie);
    return Result.ok(airOsCookie);
  }

  private doGet(
    ip: string,
    port: number,
    path: string,
    cookie: string
  ): Promise<Result<HttpsResponse>> {
    return this.httpsRequest({
      hostname: ip,
      port,
      path,
      method: 'GET',
      headers: { Cookie: cookie }
    });
  }

  private httpsRequest(
    options: https.RequestOptions,
    body?: string
  ): Promise<Result<HttpsResponse>> {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (r: Result<HttpsResponse>) => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };

      const opts: https.RequestOptions = {
        ...options,
        rejectUnauthorized: false
      };

      this.logger?.debug('[AirOsHttpClient] request', {
        method: opts.method,
        url: `https://${opts.hostname}:${opts.port}${opts.path}`
      });

      const req = https.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timer);
          settle(
            Result.ok({
              statusCode: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8')
            })
          );
        });
        res.on('error', (err) => {
          clearTimeout(timer);
          settle(Result.fail(err.message));
        });
      });

      const timer = setTimeout(() => {
        req.destroy();
        settle(
          Result.fail(
            `HTTPS_TIMEOUT (${opts.hostname}:${opts.port ?? 443})`
          )
        );
      }, this.timeoutMs);

      req.on('error', (err) => {
        clearTimeout(timer);
        settle(Result.fail(err.message));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  private parseJson(body: string): Result<unknown> {
    try {
      return Result.ok(JSON.parse(body));
    } catch {
      return Result.fail('Failed to parse status.cgi response as JSON');
    }
  }
}
