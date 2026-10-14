export interface UnlockCredentialRevealRequestDTO {
  userId: string;
  password: string;
  sourceIp: string | null;
}

export interface UnlockCredentialRevealResponseDTO {
  revealToken: string;
  expiresInSeconds: number;
}
