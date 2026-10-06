export interface LoginRequestDTO {
  email: string;
  password: string;
  // From a browser remembered at an earlier sign-in (IDN-171).
  trustedBrowserToken: string | null;
  // The caller's address, for the sign-in pause alert (IDN-045); null when
  // unknown.
  sourceIp: string | null;
}
