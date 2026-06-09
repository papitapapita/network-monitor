import { Result } from 'domain/shared/core';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): Result<TokenPayload>;
}
