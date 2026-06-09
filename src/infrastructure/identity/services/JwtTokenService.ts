import jwt from 'jsonwebtoken';
import { Result } from 'domain/shared/core';
import {
  ITokenService,
  TokenPayload
} from 'application/identity/interfaces/ITokenService';

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
    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      return Result.ok<TokenPayload>({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });
    } catch {
      return Result.fail<TokenPayload>('Invalid or expired token');
    }
  }
}
