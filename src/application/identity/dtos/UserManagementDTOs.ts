export interface UserAccountDTO {
  id: string;
  email: string;
  role: string;
  disabled: boolean;
  disabledAt: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersRequestDTO {
  callerRole: string;
}

export interface ListUsersResponseDTO {
  users: UserAccountDTO[];
}

export interface CreateUserRequestDTO {
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserRequestDTO {
  id: string;
  callerId: string;
  role?: string;
  disabled?: boolean;
  password?: string;
}

export interface ResetTwoFactorRequestDTO {
  id: string;
  callerRole: string;
  callerEmail: string;
}

export interface ChangeOwnPasswordRequestDTO {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangeOwnPasswordResponseDTO {
  // The old token stops working with the change (IDN-065); this replaces it.
  token: string;
}
