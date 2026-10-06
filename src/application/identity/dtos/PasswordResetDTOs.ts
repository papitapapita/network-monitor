export interface ForgotPasswordRequestDTO {
  email: string;
}

export interface ResetPasswordRequestDTO {
  token: string;
  password: string;
}
