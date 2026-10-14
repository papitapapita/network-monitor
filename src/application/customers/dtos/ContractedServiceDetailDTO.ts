import { ContractedServiceResponseDTO } from './ContractedServiceResponseDTO';

export interface ContractedServiceCustomerSummaryDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
}

export interface ContractedServicePlanSummaryDTO {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  isActive: boolean;
}

export interface ContractedServiceDeviceSummaryDTO {
  id: string;
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: string;
  category: string | null;
  deletedAt: string | null;
}

export interface ContractedServiceDetailDTO
  extends ContractedServiceResponseDTO {
  customer: ContractedServiceCustomerSummaryDTO;
  servicePlan: ContractedServicePlanSummaryDTO;
  device: ContractedServiceDeviceSummaryDTO | null;
}
