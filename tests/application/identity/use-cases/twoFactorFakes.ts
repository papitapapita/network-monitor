import { Result } from '../../../../src/domain/shared/core/Result';
import { NewSignInWarning } from '../../../../src/application/identity/services/NewSignInWarning';
import { User } from '../../../../src/domain/identity/aggregates/User';
import {
  ChallengeKind,
  ChallengePayload,
  ITokenService
} from '../../../../src/application/identity/interfaces/ITokenService';
import { ITwoFactorCodes } from '../../../../src/application/identity/interfaces/ITwoFactorCodes';
import { IRecoveryCodes } from '../../../../src/application/identity/interfaces/IRecoveryCodes';
import { ISecretCipher } from '../../../../src/application/identity/interfaces/ISecretCipher';

export const GOOD_CODE = '123456';
export const GOOD_STEP = 100;

// A challenge reads as `<kind>:<userId>:<tokenVersion>`.
export function challengeFor(
  user: User,
  kind: ChallengeKind,
  tokenVersion = user.tokenVersion
): string {
  return `${kind}:${user.id.toString()}:${tokenVersion}`;
}

export function makeTokens(): jest.Mocked<ITokenService> {
  return {
    sign: jest.fn().mockReturnValue('session.jwt'),
    verify: jest.fn(),
    signChallenge: jest.fn(
      (p: ChallengePayload) =>
        `${p.kind}:${p.userId}:${p.tokenVersion}`
    ),
    verifyChallenge: jest.fn((token: string, kind: ChallengeKind) => {
      const [k, userId, version] = token.split(':');
      return k === kind
        ? Result.ok<ChallengePayload>({
            userId,
            tokenVersion: Number(version),
            kind
          })
        : Result.fail<ChallengePayload>('Invalid or expired token');
    })
  };
}

export function makeCodes(): jest.Mocked<ITwoFactorCodes> {
  return {
    generateSecret: jest.fn().mockReturnValue('NEWSECRET'),
    provisioningUri: jest.fn(
      (secret: string, account: string, issuer: string) =>
        `otpauth://totp/${issuer}:${account}?secret=${secret}`
    ),
    matchStep: jest.fn(
      (_secret: string, code: string, _now: Date): number | null =>
        code === GOOD_CODE ? GOOD_STEP : null
    )
  };
}

export function makeRecoveryCodes(): IRecoveryCodes {
  const hash = (code: string) =>
    `h:${code.toUpperCase().replace(/[\s-]/g, '')}`;
  return {
    generate: () => {
      const codes = ['AAAAA-BBBBB', 'CCCCC-DDDDD'];
      return { codes, hashes: codes.map(hash) };
    },
    hash
  };
}

export function makeCipher(): ISecretCipher {
  return {
    encrypt: (plain: string) => `enc:${plain}`,
    decrypt: (cipher: string) => cipher.replace(/^enc:/, '')
  };
}

// An account with two-factor on, whose last accepted step is GOOD_STEP - 5.
export function withTwoFactor(user: User): User {
  user.startTwoFactorSetup('enc:SECRET');
  user.confirmTwoFactor(GOOD_STEP - 5, ['h:AAAAABBBBB'], new Date());
  return user;
}

export function makeWarning(): jest.Mocked<NewSignInWarning> {
  return {
    send: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<NewSignInWarning>;
}
