import jwt from 'jsonwebtoken';
import { Result } from 'domain/shared/core';
import {
  ChallengeKind,
  ChallengePayload,
  ITokenService,
  TokenPayload
} from 'application/identity/interfaces/ITokenService';

const INVALID_TOKEN = 'Invalid or expired token';

// IDN-167, IDN-171, IDN-183, IDN-184.
const LIFETIMES: Record<ChallengeKind, jwt.SignOptions['expiresIn']> =
  {
    'two-factor': '5m',
    'two-factor-setup': '5m',
    'trusted-browser': '30d',
    'password-reset': '1h',
    invitation: '7d'
  };

export class JwtTokenService implements ITokenService {
  private readonly secret: string;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.secret = secret;
  }

  public sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: '24h'
    });
  }

  public verify(token: string): Result<TokenPayload> {
    const decoded = this.decode(token);
    // A token signed before sessions were versioned carries none; a
    // challenge carries a kind and only opens the next sign-in step.
    if (
      !decoded ||
      !Number.isInteger(decoded.tokenVersion) ||
      decoded.kind !== undefined
    ) {
      return Result.fail<TokenPayload>(INVALID_TOKEN);
    }
    return Result.ok<TokenPayload>({
      userId: decoded.userId as string,
      email: decoded.email as string,
      role: decoded.role as string,
      tokenVersion: decoded.tokenVersion as number
    });
  }

  public signChallenge(payload: ChallengePayload): string {
    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      expiresIn: LIFETIMES[payload.kind]
    });
  }

  public verifyChallenge(
    token: string,
    kind: ChallengeKind
  ): Result<ChallengePayload> {
    const decoded = this.decode(token);
    if (
      !decoded ||
      decoded.kind !== kind ||
      typeof decoded.userId !== 'string' ||
      !Number.isInteger(decoded.tokenVersion)
    ) {
      return Result.fail<ChallengePayload>(INVALID_TOKEN);
    }
    return Result.ok<ChallengePayload>({
      userId: decoded.userId,
      tokenVersion: decoded.tokenVersion as number,
      kind
    });
  }

  private decode(token: string): jwt.JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256']
      });
      return typeof decoded === 'string' ? null : decoded;
    } catch {
      return null;
    }
  }
}
