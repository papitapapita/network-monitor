import jwt from 'jsonwebtoken';
import { JwtTokenService } from '../../../../src/infrastructure/identity/services/JwtTokenService';

const SECRET = 'test-secret-for-jwt-token-service';

describe('JwtTokenService', () => {
  let tokens: JwtTokenService;
  const session = {
    userId: 'u-1',
    email: 'staff@isp.example',
    role: 'ADMIN',
    tokenVersion: 2
  };
  const challenge = {
    userId: 'u-1',
    tokenVersion: 2,
    kind: 'two-factor' as const
  };

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
    tokens = new JwtTokenService();
  });

  it('reads back a session token', () => {
    expect(tokens.verify(tokens.sign(session)).value).toEqual(
      session
    );
  });

  it('reads back a challenge of the same kind', () => {
    const token = tokens.signChallenge(challenge);

    expect(tokens.verifyChallenge(token, 'two-factor').value).toEqual(
      challenge
    );
  });

  it('[IDN-167] a challenge never passes as a session', () => {
    const token = tokens.signChallenge(challenge);

    expect(tokens.verify(token).isFailure).toBe(true);
  });

  it('[IDN-167] a session never passes as a challenge', () => {
    const token = tokens.sign(session);

    expect(
      tokens.verifyChallenge(token, 'two-factor').isFailure
    ).toBe(true);
  });

  it('[IDN-167] a challenge of one kind does not open the other step', () => {
    const token = tokens.signChallenge(challenge);

    expect(
      tokens.verifyChallenge(token, 'two-factor-setup').isFailure
    ).toBe(true);
  });

  it('[IDN-167] a challenge lasts five minutes', () => {
    const token = tokens.signChallenge(challenge);
    const { iat, exp } = jwt.decode(token) as jwt.JwtPayload;

    expect(exp! - iat!).toBe(300);
  });

  it('[IDN-171] a remembered browser lasts 30 days', () => {
    const token = tokens.signChallenge({
      userId: 'u-1',
      tokenVersion: 0,
      kind: 'trusted-browser'
    });
    const { iat, exp } = jwt.decode(token) as jwt.JwtPayload;

    expect(exp! - iat!).toBe(30 * 24 * 60 * 60);
  });

  it('[IDN-183] a password reset link lasts one hour', () => {
    const token = tokens.signChallenge({
      userId: 'u-1',
      tokenVersion: 0,
      kind: 'password-reset'
    });
    const { iat, exp } = jwt.decode(token) as jwt.JwtPayload;

    expect(exp! - iat!).toBe(60 * 60);
    expect(tokens.verify(token).isFailure).toBe(true);
  });

  it('[IDN-184] an invitation lasts seven days', () => {
    const token = tokens.signChallenge({
      userId: 'u-1',
      tokenVersion: 0,
      kind: 'invitation'
    });
    const { iat, exp } = jwt.decode(token) as jwt.JwtPayload;

    expect(exp! - iat!).toBe(7 * 24 * 60 * 60);
  });

  it('[IDN-171] a remembered browser is neither a session nor a challenge', () => {
    const token = tokens.signChallenge({
      userId: 'u-1',
      tokenVersion: 0,
      kind: 'trusted-browser'
    });

    expect(tokens.verify(token).isFailure).toBe(true);
    expect(
      tokens.verifyChallenge(token, 'two-factor').isFailure
    ).toBe(true);
  });

  it('refuses a challenge signed with another secret', () => {
    const forged = jwt.sign(challenge, 'other-secret');

    expect(
      tokens.verifyChallenge(forged, 'two-factor').isFailure
    ).toBe(true);
  });
});
