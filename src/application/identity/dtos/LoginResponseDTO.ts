export interface UserDTO {
  id: string;
  email: string;
  role: string;
}

// A right password never signs in on its own: it opens the two-factor step
// (IDN-166).
export interface LoginResponseDTO {
  twoFactor: 'verify' | 'setup';
  challengeToken: string;
}
