export interface LoginResponseDTO {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
