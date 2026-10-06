import { Result } from 'domain/shared/core';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  // The user's tokenVersion when the token was signed (IDN-065).
  tokenVersion: number;
}

// The step a password opens: typing a code, or setting the app up first
// (IDN-166); or a browser that may skip the code for 30 days (IDN-171).
export type ChallengeKind =
  | 'two-factor'
  | 'two-factor-setup'
  | 'trusted-browser';

export interface ChallengePayload {
  userId: string;
  tokenVersion: number;
  kind: ChallengeKind;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  // Refuses challenge tokens: they never open a session (IDN-167).
  verify(token: string): Result<TokenPayload>;
  signChallenge(payload: ChallengePayload): string;
  // Refuses session tokens and challenges of another kind (IDN-167).
  verifyChallenge(
    token: string,
    kind: ChallengeKind
  ): Result<ChallengePayload>;
}
