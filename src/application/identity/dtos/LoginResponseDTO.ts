import type { SessionResponseDTO } from './TwoFactorDTOs';

export interface UserDTO {
  id: string;
  email: string;
  role: string;
}

export interface TwoFactorStepDTO {
  twoFactor: 'verify' | 'setup';
  challengeToken: string;
}

// A right password alone opens the two-factor step (IDN-166); from a
// remembered browser it signs in (IDN-171).
export type LoginResponseDTO = TwoFactorStepDTO | SessionResponseDTO;
