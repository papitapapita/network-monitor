// Source: src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts

jest.mock('https');

import * as https from 'https';
import { EventEmitter } from 'events';
import { AirOsHttpClient } from '../../../../src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient';

// ---------------------------------------------------------------------------
// Helpers to build fake https.request responses
// ---------------------------------------------------------------------------

interface FakeResponseOptions {
  statusCode: number;
  headers?: Record<string, string | string[]>;
  body?: string;
  emitError?: string;
}

function stubRequest(
  authOpts: FakeResponseOptions,
  statusOpts?: FakeResponseOptions
): void {
  let callCount = 0;
  (https.request as jest.Mock).mockImplementation(
    (
      options: https.RequestOptions,
      callback?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
    ) => {
      callCount++;
      const isAuth = (options.path ?? '').includes('/api/auth');
      const opts = isAuth || statusOpts === undefined ? authOpts : statusOpts;
      if (!isAuth && statusOpts !== undefined) {
        // second+ call is for status.cgi
      }

      const req = new EventEmitter() as EventEmitter & {
        end: jest.Mock;
        write: jest.Mock;
        destroy: jest.Mock;
      };
      req.end = jest.fn().mockImplementation(() => {
        if (callback) {
          const res = new EventEmitter() as EventEmitter & {
            statusCode?: number;
            headers: Record<string, unknown>;
          };
          res.statusCode = opts.statusCode;
          res.headers = opts.headers ?? {};
          callback(res);
          if (opts.emitError) {
            res.emit('error', new Error(opts.emitError));
          } else {
            res.emit('data', Buffer.from(opts.body ?? ''));
            res.emit('end');
          }
        }
      });
      req.write = jest.fn();
      req.destroy = jest.fn().mockImplementation(() => {
        req.emit('error', new Error('socket hang up'));
      });
      return req;
    }
  );
}

function stubRequestError(message: string): void {
  (https.request as jest.Mock).mockImplementation(
    (_opts: https.RequestOptions, _cb?: unknown) => {
      const req = new EventEmitter() as EventEmitter & {
        end: jest.Mock;
        write: jest.Mock;
        destroy: jest.Mock;
      };
      req.end = jest.fn().mockImplementation(() => {
        req.emit('error', new Error(message));
      });
      req.write = jest.fn();
      req.destroy = jest.fn();
      return req;
    }
  );
}

// ---------------------------------------------------------------------------

const IP = '192.168.1.1';
const PORT = 443;
const CREDS = { username: 'ubnt', password: 'ubnt' };
const SESSION_COOKIE = 'AIROS_AABBCCDDEEFF=abc123';
const STATUS_BODY = JSON.stringify({
  host: { hostname: 'ap-1' },
  wireless: {}
});

const AUTH_OK: FakeResponseOptions = {
  statusCode: 200,
  headers: { 'set-cookie': [`${SESSION_COOKIE}; Path=/`] },
  body: ''
};

describe('[WLS-040] [WLS-041] [WLS-042] [WLS-043] [WLS-044] [WLS-045] [WLS-046] [WLS-047] AirOsHttpClient', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('fetchStatus — successful auth and data fetch', () => {
    it('should return ok with parsed JSON on a clean first call', async () => {
      stubRequest(AUTH_OK, { statusCode: 200, body: STATUS_BODY });

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      expect(
        (result.value as Record<string, unknown>)['host']
      ).toBeDefined();
    });

    it('should POST to /api/auth before GETing /status.cgi', async () => {
      const paths: string[] = [];
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          paths.push(opts.path ?? '');
          const isAuth = (opts.path ?? '').includes('/api/auth');
          const fakeOpts = isAuth
            ? AUTH_OK
            : { statusCode: 200, body: STATUS_BODY };
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = fakeOpts.statusCode;
              res.headers = (fakeOpts as FakeResponseOptions).headers ?? {};
              cb(res);
              res.emit('data', Buffer.from(fakeOpts.body ?? ''));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );

      const client = new AirOsHttpClient();
      await client.fetchStatus(IP, PORT, CREDS);

      expect(paths[0]).toBe('/api/auth');
      expect(paths[1]).toBe('/status.cgi');
    });

    it('should reuse the session cookie and skip re-auth on a second call', async () => {
      let authCallCount = 0;
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          const isAuth = (opts.path ?? '').includes('/api/auth');
          if (isAuth) authCallCount++;
          const fakeOpts = isAuth
            ? AUTH_OK
            : { statusCode: 200, body: STATUS_BODY };
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = fakeOpts.statusCode;
              res.headers = (fakeOpts as FakeResponseOptions).headers ?? {};
              cb(res);
              res.emit('data', Buffer.from(fakeOpts.body ?? ''));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );

      const client = new AirOsHttpClient();
      await client.fetchStatus(IP, PORT, CREDS);
      await client.fetchStatus(IP, PORT, CREDS);

      expect(authCallCount).toBe(1);
    });
  });

  // ===========================================================================
  describe('fetchStatus — session expiry (401)', () => {
    it('should re-authenticate once and retry on 401 from status.cgi', async () => {
      let authCallCount = 0;
      let statusCallCount = 0;
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          const isAuth = (opts.path ?? '').includes('/api/auth');
          if (isAuth) authCallCount++;
          else statusCallCount++;
          const statusCode = isAuth ? 200 : statusCallCount === 1 ? 401 : 200;
          const headers = isAuth ? { 'set-cookie': [`${SESSION_COOKIE}; Path=/`] } : {};
          const body = isAuth ? '' : STATUS_BODY;
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = statusCode;
              res.headers = headers;
              cb(res);
              res.emit('data', Buffer.from(body));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      expect(authCallCount).toBe(2);
    });

    it('should fail if re-auth also fails after 401', async () => {
      let authCallCount = 0;
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          const isAuth = (opts.path ?? '').includes('/api/auth');
          if (isAuth) authCallCount++;
          const statusCode = isAuth
            ? authCallCount === 1 ? 200 : 401
            : 401;
          const headers = isAuth && authCallCount === 1
            ? { 'set-cookie': [`${SESSION_COOKIE}; Path=/`] }
            : {};
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = statusCode;
              res.headers = headers;
              cb(res);
              res.emit('data', Buffer.from(''));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('fetchStatus — session expiry (403)', () => {
    // AirOS rejects a cookie it no longer holds with 403, not 401. Treating
    // that as fatal used to poison the session cache until a process restart.
    function stubStatusCodes(statusCodes: number[]): () => number {
      let authCallCount = 0;
      let statusCallCount = 0;
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          const isAuth = (opts.path ?? '').includes('/api/auth');
          if (isAuth) authCallCount++;
          else statusCallCount++;
          const statusCode = isAuth
            ? 200
            : (statusCodes[statusCallCount - 1] ??
              statusCodes[statusCodes.length - 1]!);
          const headers = isAuth
            ? { 'set-cookie': [`${SESSION_COOKIE}; Path=/`] }
            : {};
          const body = isAuth ? '' : STATUS_BODY;
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = statusCode;
              res.headers = headers;
              cb(res);
              res.emit('data', Buffer.from(body));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );
      return () => authCallCount;
    }

    it('should re-authenticate once and retry on 403 from status.cgi', async () => {
      const authCalls = stubStatusCodes([403, 200]);

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      expect(authCalls()).toBe(2);
    });

    it('should not keep serving a cookie the device rejected with 403', async () => {
      const authCalls = stubStatusCodes([403]);

      const client = new AirOsHttpClient();
      const first = await client.fetchStatus(IP, PORT, CREDS);
      const second = await client.fetchStatus(IP, PORT, CREDS);

      expect(first.isFailure).toBe(true);
      expect(second.isFailure).toBe(true);
      // 2 auths per call — the cache must not survive a failed retry, otherwise
      // the second call reuses the dead cookie and only re-auths once
      expect(authCalls()).toBe(4);
    });

    it('should recover on the next poll after a 403 outage clears', async () => {
      const authCalls = stubStatusCodes([403, 403, 200]);

      const client = new AirOsHttpClient();
      const first = await client.fetchStatus(IP, PORT, CREDS);
      const second = await client.fetchStatus(IP, PORT, CREDS);

      expect(first.isFailure).toBe(true);
      expect(second.isSuccess).toBe(true);
      expect(authCalls()).toBe(3);
    });
  });

  // ===========================================================================
  describe('fetchStatus — auth failure', () => {
    it('should fail when auth returns non-200/201', async () => {
      stubRequest({ statusCode: 403, body: '' });

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Authentication failed');
    });

    it('should fail when no AIROS cookie is returned by auth', async () => {
      stubRequest({ statusCode: 200, headers: {}, body: '' });

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('AIROS session cookie');
    });
  });

  // ===========================================================================
  describe('fetchStatus — network errors', () => {
    it('should fail when auth request emits a socket error', async () => {
      stubRequestError('ECONNREFUSED');

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should fail when status.cgi response emits an error mid-body', async () => {
      stubRequest(AUTH_OK, { statusCode: 200, emitError: 'socket hang up' });

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('fetchStatus — invalid JSON', () => {
    it('should fail when status.cgi response is not valid JSON', async () => {
      stubRequest(AUTH_OK, { statusCode: 200, body: 'not-json' });

      const client = new AirOsHttpClient();
      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('JSON');
    });
  });

  // ===========================================================================
  describe('reboot', () => {
    const CSRF_ID = 'csrf-token-123';

    function stubReboot(options: {
      authHeaders?: Record<string, string | string[]>;
      rebootStatusCodes?: number[];
    }): { requests: https.RequestOptions[] } {
      const requests: https.RequestOptions[] = [];
      let rebootCallCount = 0;
      (https.request as jest.Mock).mockImplementation(
        (
          opts: https.RequestOptions,
          cb?: (res: EventEmitter & { statusCode?: number; headers: Record<string, unknown> }) => void
        ) => {
          requests.push(opts);
          const isAuth = (opts.path ?? '').includes('/api/auth');
          let statusCode: number;
          let headers: Record<string, string | string[]> = {};
          if (isAuth) {
            statusCode = 200;
            headers = options.authHeaders ?? {
              'set-cookie': [`${SESSION_COOKIE}; Path=/`],
              'x-csrf-id': CSRF_ID
            };
          } else {
            statusCode =
              options.rebootStatusCodes?.[rebootCallCount] ?? 200;
            rebootCallCount++;
          }
          const req = new EventEmitter() as EventEmitter & { end: jest.Mock; write: jest.Mock; destroy: jest.Mock };
          req.end = jest.fn().mockImplementation(() => {
            if (cb) {
              const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, unknown> };
              res.statusCode = statusCode;
              res.headers = headers;
              cb(res);
              res.emit('data', Buffer.from(''));
              res.emit('end');
            }
          });
          req.write = jest.fn();
          req.destroy = jest.fn();
          return req;
        }
      );
      return { requests };
    }

    it('should POST to /api/system/reboot with cookie and CSRF header', async () => {
      const { requests } = stubReboot({});

      const client = new AirOsHttpClient();
      const result = await client.reboot(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      const rebootReq = requests.find(
        (r) => r.path === '/api/system/reboot'
      );
      expect(rebootReq).toBeDefined();
      expect(rebootReq!.method).toBe('POST');
      expect(rebootReq!.headers?.['Cookie']).toBe(SESSION_COOKIE);
      expect(rebootReq!.headers?.['X-CSRF-ID']).toBe(CSRF_ID);
    });

    it('should tolerate a missing x-csrf-id header on auth', async () => {
      const { requests } = stubReboot({
        authHeaders: { 'set-cookie': [`${SESSION_COOKIE}; Path=/`] }
      });

      const client = new AirOsHttpClient();
      const result = await client.reboot(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      const rebootReq = requests.find(
        (r) => r.path === '/api/system/reboot'
      );
      expect(rebootReq!.headers?.['X-CSRF-ID']).toBeUndefined();
    });

    it('should re-authenticate once and retry when reboot returns 401', async () => {
      const { requests } = stubReboot({ rebootStatusCodes: [401, 200] });

      const client = new AirOsHttpClient();
      const result = await client.reboot(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
      const authCalls = requests.filter(
        (r) => r.path === '/api/auth'
      );
      expect(authCalls).toHaveLength(2);
    });

    it('should fail when reboot returns a non-success status', async () => {
      stubReboot({ rebootStatusCodes: [500] });

      const client = new AirOsHttpClient();
      const result = await client.reboot(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('HTTP 500');
    });

    it('should drop the session after a successful reboot', async () => {
      const { requests } = stubReboot({});

      const client = new AirOsHttpClient();
      await client.reboot(IP, PORT, CREDS);
      await client.reboot(IP, PORT, CREDS);

      const authCalls = requests.filter(
        (r) => r.path === '/api/auth'
      );
      expect(authCalls).toHaveLength(2);
    });

    it('should fail when auth fails', async () => {
      stubRequest({ statusCode: 403, body: '' });

      const client = new AirOsHttpClient();
      const result = await client.reboot(IP, PORT, CREDS);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Authentication failed');
    });
  });
  // ===========================================================================
  describe('[WLS-044] radio certificates', () => {
    it('should disable certificate verification on every request', async () => {
      stubRequest(AUTH_OK, { statusCode: 200, body: STATUS_BODY });
      const client = new AirOsHttpClient();

      await client.fetchStatus(IP, PORT, CREDS);

      const calls = (https.request as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [options] of calls) {
        expect(options.rejectUnauthorized).toBe(false);
      }
    });
  });

  // ===========================================================================
  describe('[WLS-045] request timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fail with HTTPS_TIMEOUT naming host and port when the radio never answers', async () => {
      (https.request as jest.Mock).mockImplementation(() => {
        const req = new EventEmitter() as EventEmitter & {
          end: jest.Mock;
          write: jest.Mock;
          destroy: jest.Mock;
        };
        req.end = jest.fn();
        req.write = jest.fn();
        req.destroy = jest.fn();
        return req;
      });

      const client = new AirOsHttpClient(10_000);
      const pending = client.fetchStatus(IP, PORT, CREDS);

      jest.advanceTimersByTime(10_000);
      const result = await pending;

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(`HTTPS_TIMEOUT (${IP}:${PORT})`);
    });

    it('should destroy the socket when the deadline passes', async () => {
      const destroy = jest.fn();
      (https.request as jest.Mock).mockImplementation(() => {
        const req = new EventEmitter() as EventEmitter & {
          end: jest.Mock;
          write: jest.Mock;
          destroy: jest.Mock;
        };
        req.end = jest.fn();
        req.write = jest.fn();
        req.destroy = destroy;
        return req;
      });

      const client = new AirOsHttpClient(5_000);
      const pending = client.fetchStatus(IP, PORT, CREDS);

      jest.advanceTimersByTime(5_000);
      await pending;

      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('should ignore a socket error arriving after the timeout already settled', async () => {
      let lastReq: EventEmitter | null = null;
      (https.request as jest.Mock).mockImplementation(() => {
        const req = new EventEmitter() as EventEmitter & {
          end: jest.Mock;
          write: jest.Mock;
          destroy: jest.Mock;
        };
        req.end = jest.fn();
        req.write = jest.fn();
        // Node destroys asynchronously, so the error lands after the timeout
        req.destroy = jest.fn();
        lastReq = req;
        return req;
      });

      const client = new AirOsHttpClient(1_000);
      const pending = client.fetchStatus(IP, PORT, CREDS);

      jest.advanceTimersByTime(1_000);
      lastReq!.emit('error', new Error('socket hang up'));
      const result = await pending;

      expect(result.error).toBe(`HTTPS_TIMEOUT (${IP}:${PORT})`);
    });

    it('should not time out a request that answers in time', async () => {
      stubRequest(AUTH_OK, { statusCode: 200, body: STATUS_BODY });
      const client = new AirOsHttpClient(10_000);

      const result = await client.fetchStatus(IP, PORT, CREDS);

      expect(result.isSuccess).toBe(true);
    });
  });
});
