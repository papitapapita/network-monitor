import {
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedServiceStatus } from '../enums';

export interface ContractedServiceProps {
  customerId: CustomerId;
  servicePlanId: ServicePlanId;
  deviceId: DeviceId | null;
  status: ContractedServiceStatus;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
