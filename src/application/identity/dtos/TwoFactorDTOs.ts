import { UserDTO } from './LoginResponseDTO';

export interface SessionResponseDTO {
  token: string;
  user: UserDTO;
}

export interface StartTwoFactorSetupRequestDTO {
  challengeToken: string;
}

export interface StartTwoFactorSetupResponseDTO {
  // Base32, for typing into the app when the QR code cannot be scanned.
  secret: string;
  otpauthUri: string;
}

export interface ConfirmTwoFactorSetupRequestDTO {
  challengeToken: string;
  code: string;
  sourceIp: string | null;
}

export interface ConfirmTwoFactorSetupResponseDTO
  extends SessionResponseDTO {
  // Shown once; only their hashes are kept (IDN-163).
  recoveryCodes: string[];
}

export interface VerifyTwoFactorRequestDTO {
  challengeToken: string;
  code: string | null;
  recoveryCode: string | null;
  sourceIp: string | null;
}
