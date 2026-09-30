import { Result } from 'domain/shared/core';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  // The user's tokenVersion when the token was signed (IDN-065).
  tokenVersion: number;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): Result<TokenPayload>;
}
