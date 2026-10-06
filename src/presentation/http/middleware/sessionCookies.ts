import { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'nms_session';
export const TRUSTED_BROWSER_COOKIE = 'nms_trusted_browser';

const DAY_MS = 24 * 60 * 60 * 1000;

// httpOnly keeps the tokens away from scripts on the page; Strict keeps the
// browser from sending them with a request another site started (IDN-066).
// Browsers accept Secure cookies from http://localhost, so dev needs no
// exception.
const BASE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
};

const SESSION: CookieOptions = { ...BASE, path: '/', maxAge: DAY_MS };

// Only the sign-in routes read it (IDN-171).
const TRUSTED_BROWSER: CookieOptions = {
  ...BASE,
  path: '/api/auth',
  maxAge: 30 * DAY_MS
};

export function setSessionCookies(
  res: Response,
  data: { token?: unknown; trustedBrowserToken?: unknown }
): void {
  if (typeof data.token === 'string') {
    res.cookie(SESSION_COOKIE, data.token, SESSION);
  }
  if (typeof data.trustedBrowserToken === 'string') {
    res.cookie(
      TRUSTED_BROWSER_COOKIE,
      data.trustedBrowserToken,
      TRUSTED_BROWSER
    );
  }
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...BASE, path: '/' });
}

export function readCookie(
  req: Request,
  name: string
): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(at + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}
