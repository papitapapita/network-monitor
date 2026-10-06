// Source: src/presentation/http/middleware/sessionCookies.ts

import express, { Request } from 'express';
import request from 'supertest';
import {
  clearSessionCookie,
  readCookie,
  setSessionCookies
} from '../../../../src/presentation/http/middleware/sessionCookies';

const withCookie = (cookie?: string) =>
  ({ headers: cookie === undefined ? {} : { cookie } }) as Request;

describe('sessionCookies', () => {
  describe('readCookie', () => {
    it('finds the named cookie among others', () => {
      expect(
        readCookie(
          withCookie('a=1; nms_session=abc.def; b=2'),
          'nms_session'
        )
      ).toBe('abc.def');
    });

    it('answers null when it is missing, empty or garbled', () => {
      expect(readCookie(withCookie(), 'nms_session')).toBeNull();
      expect(
        readCookie(withCookie('nms_session='), 'nms_session')
      ).toBeNull();
      expect(
        readCookie(withCookie('nms_session=%E0'), 'nms_session')
      ).toBeNull();
    });

    it('does not match a cookie whose name only ends the same', () => {
      expect(
        readCookie(withCookie('x_nms_session=1'), 'nms_session')
      ).toBeNull();
    });
  });

  describe('setting and clearing', () => {
    const app = express();
    app.get('/set', (_req, res) => {
      setSessionCookies(res, {
        token: 'session.jwt',
        trustedBrowserToken: 'browser.jwt'
      });
      res.send();
    });
    app.get('/challenge', (_req, res) => {
      setSessionCookies(res, { twoFactor: 'verify' } as object);
      res.send();
    });
    app.get('/clear', (_req, res) => {
      clearSessionCookie(res);
      res.send();
    });

    const cookies = async (path: string) =>
      ((await request(app).get(path)).headers['set-cookie'] ??
        []) as unknown as string[];

    it('[IDN-066] the session is httpOnly, Secure, Strict, for a day', async () => {
      const session = (await cookies('/set')).find((c) =>
        c.startsWith('nms_session=')
      )!;

      expect(session).toMatch(/HttpOnly/);
      expect(session).toMatch(/Secure/);
      expect(session).toMatch(/SameSite=Strict/);
      expect(session).toMatch(/Path=\//);
      expect(session).toMatch(/Max-Age=86400/);
    });

    it('[IDN-171] the remembered browser is sent only to the sign-in routes, for 30 days', async () => {
      const browser = (await cookies('/set')).find((c) =>
        c.startsWith('nms_trusted_browser=')
      )!;

      expect(browser).toMatch(/Path=\/api\/auth/);
      expect(browser).toMatch(/Max-Age=2592000/);
      expect(browser).toMatch(/HttpOnly/);
    });

    it('sets nothing for an answer without tokens', async () => {
      expect(await cookies('/challenge')).toEqual([]);
    });

    it('[IDN-062] clearing expires the session cookie', async () => {
      const [cleared] = await cookies('/clear');

      expect(cleared).toMatch(/^nms_session=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });
});
