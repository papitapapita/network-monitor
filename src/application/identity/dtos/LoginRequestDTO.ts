export interface LoginRequestDTO {
  email: string;
  password: string;
  // The caller's address, for the sign-in pause alert (IDN-045); null when
  // unknown.
  sourceIp: string | null;
}
