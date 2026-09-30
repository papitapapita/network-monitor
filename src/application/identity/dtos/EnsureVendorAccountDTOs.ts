export interface EnsureVendorAccountRequestDTO {
  email: string;
  password?: string;
}

export interface EnsureVendorAccountResponseDTO {
  userId: string;
  outcome: 'created' | 'promoted' | 'unchanged';
}
