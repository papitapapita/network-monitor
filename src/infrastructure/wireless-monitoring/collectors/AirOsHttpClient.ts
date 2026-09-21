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

interface AirOsSession {
  cookie: string;
  csrfId: string | null;
}

export class AirOsHttpClient {
  private readonly timeoutMs: number;
  private readonly sessions = new Map<string, AirOsSession>();

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
    let session = this.sessions.get(ip);
    if (!session) {
      const authResult = await this.authenticate(ip, port, creds);
      if (authResult.isFailure) return Result.fail(authResult.error!);
      session = authResult.value;
    }

    const getResult = await this.doGet(
      ip,
      port,
      '/status.cgi',
      session
    );
    if (getResult.isFailure) return Result.fail(getResult.error!);

    if (this.isSessionExpired(getResult.value.statusCode)) {
      this.sessions.delete(ip);
      const reAuthResult = await this.authenticate(ip, port, creds);
      if (reAuthResult.isFailure)
        return Result.fail(reAuthResult.error!);
      const retryResult = await this.doGet(
        ip,
        port,
        '/status.cgi',
        reAuthResult.value
      );
      if (retryResult.isFailure) {
        this.sessions.delete(ip);
        return Result.fail(retryResult.error!);
      }
      if (retryResult.value.statusCode !== 200) {
        this.sessions.delete(ip);
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

  async reboot(
    ip: string,
    port: number,
    creds: AirOsCredentials
  ): Promise<Result<void>> {
    let session = this.sessions.get(ip);
    if (!session) {
      const authResult = await this.authenticate(ip, port, creds);
      if (authResult.isFailure) return Result.fail(authResult.error!);
      session = authResult.value;
    }

    const postResult = await this.doPost(
      ip,
      port,
      '/api/system/reboot',
      session
    );
    if (postResult.isFailure) return Result.fail(postResult.error!);

    if (this.isSessionExpired(postResult.value.statusCode)) {
      this.sessions.delete(ip);
      const reAuthResult = await this.authenticate(ip, port, creds);
      if (reAuthResult.isFailure)
        return Result.fail(reAuthResult.error!);
      const retryResult = await this.doPost(
        ip,
        port,
        '/api/system/reboot',
        reAuthResult.value
      );
      if (retryResult.isFailure) {
        this.sessions.delete(ip);
        return Result.fail(retryResult.error!);
      }
      if (!this.isSuccess(retryResult.value.statusCode)) {
        this.sessions.delete(ip);
        return Result.fail(
          `Reboot request returned HTTP ${retryResult.value.statusCode} after re-auth`
        );
      }
      this.sessions.delete(ip);
      return Result.ok();
    }

    if (!this.isSuccess(postResult.value.statusCode)) {
      return Result.fail(
        `Reboot request returned HTTP ${postResult.value.statusCode}`
      );
    }
    // the device drops all sessions when it restarts
    this.sessions.delete(ip);
    return Result.ok();
  }

  private isSuccess(statusCode: number): boolean {
    return statusCode === 200 || statusCode === 201;
  }

  // AirOS answers 403 — not 401 — when it rejects a cookie it no longer holds
  // in its session table, and on a stale CSRF id. Both are cured by re-auth.
  private isSessionExpired(statusCode: number): boolean {
    return (
      statusCode === 401 || statusCode === 403 || statusCode === 302
    );
  }

  private async authenticate(
    ip: string,
    port: number,
    creds: AirOsCredentials
  ): Promise<Result<AirOsSession>> {
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
    if (statusCode === 401 || statusCode === 403) {
      return Result.fail(`Authentication failed: HTTP ${statusCode}`);
    }
    // airOS 6 has no /api/auth: it redirects to /cookiechecker or 404s
    if (statusCode !== 200 && statusCode !== 201) {
      return this.authenticateLegacy(ip, port, creds);
    }

    const airOsCookie = this.extractAirOsCookie(headers);

    if (!airOsCookie) {
      return Result.fail(
        'No AIROS session cookie in authentication response'
      );
    }

    // some 8.x firmwares do not issue a CSRF token; POSTs work without it there
    const rawCsrfId = headers['x-csrf-id'];
    const csrfId = Array.isArray(rawCsrfId)
      ? (rawCsrfId[0] ?? null)
      : (rawCsrfId ?? null);

    const session: AirOsSession = { cookie: airOsCookie, csrfId };
    this.sessions.set(ip, session);
    return Result.ok(session);
  }

  private extractAirOsCookie(
    headers: IncomingHttpHeaders
  ): string | undefined {
    const rawCookies = headers['set-cookie'] ?? [];
    const cookieList = Array.isArray(rawCookies)
      ? rawCookies
      : [rawCookies];
    return cookieList
      .map((h) => h.split(';')[0]?.trim())
      .find((s) => s !== undefined && /^AIROS_[0-9A-Fa-f]+=/.test(s));
  }

  // airOS 6 refuses a login POST that carries no session cookie yet, so the
  // cookie is fetched first. A rejected login re-renders the form with HTTP
  // 200; only a redirect away from the login page means success.
  private async authenticateLegacy(
    ip: string,
    port: number,
    creds: AirOsCredentials
  ): Promise<Result<AirOsSession>> {
    const primer = await this.httpsRequest({
      hostname: ip,
      port,
      path: '/login.cgi',
      method: 'GET'
    });
    if (primer.isFailure) return Result.fail(primer.error!);

    const cookie = this.extractAirOsCookie(primer.value.headers);
    if (!cookie) {
      return Result.fail(
        'No AIROS session cookie from legacy login page'
      );
    }

    const boundary = `----nms${Date.now().toString(16)}`;
    const field = (name: string, value: string) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    const body =
      field('username', creds.username) +
      field('password', creds.password) +
      field('uri', '/') +
      `--${boundary}--\r\n`;

    const login = await this.httpsRequest(
      {
        hostname: ip,
        port,
        path: '/login.cgi',
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      body
    );
    if (login.isFailure) return Result.fail(login.error!);

    const { statusCode, headers } = login.value;
    const location = String(headers['location'] ?? '');
    if (statusCode !== 302 || location.includes('login.cgi')) {
      return Result.fail(
        'Authentication failed: invalid credentials'
      );
    }

    const session: AirOsSession = {
      cookie: this.extractAirOsCookie(headers) ?? cookie,
      csrfId: null
    };
    this.sessions.set(ip, session);
    return Result.ok(session);
  }

  private doGet(
    ip: string,
    port: number,
    path: string,
    session: AirOsSession
  ): Promise<Result<HttpsResponse>> {
    return this.httpsRequest({
      hostname: ip,
      port,
      path,
      method: 'GET',
      headers: { Cookie: session.cookie }
    });
  }

  private doPost(
    ip: string,
    port: number,
    path: string,
    session: AirOsSession
  ): Promise<Result<HttpsResponse>> {
    const headers: Record<string, string | number> = {
      Cookie: session.cookie,
      'Content-Length': 0
    };
    if (session.csrfId) {
      headers['X-CSRF-ID'] = session.csrfId;
    }
    return this.httpsRequest({
      hostname: ip,
      port,
      path,
      method: 'POST',
      headers
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
      return Result.fail(
        'Failed to parse status.cgi response as JSON'
      );
    }
  }
}
