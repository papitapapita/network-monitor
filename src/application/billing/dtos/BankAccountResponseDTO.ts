export interface BankAccountResponseDTO {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  // Ready-made option text for a picker: "Bancolombia · Ahorros · 39500002227"
  label: string;
  createdAt: string;
  updatedAt: string;
}
