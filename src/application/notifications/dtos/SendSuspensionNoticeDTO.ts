export interface SendSuspensionNoticeDTO {
  contractedServiceId: string;
}

export interface SuspensionNoticeResponseDTO {
  contractedServiceId: string;
  customerId: string;
  sentAt: string;
}
