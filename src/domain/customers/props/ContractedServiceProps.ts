import {
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedServiceStatus } from '../enums';
import { PaymentDay } from '../value-objects';

export interface ContractedServiceProps {
  customerId: CustomerId;
  servicePlanId: ServicePlanId;
  deviceId: DeviceId | null;
  status: ContractedServiceStatus;
  startDate: Date;
  paymentDay: PaymentDay;
  createdAt: Date;
  updatedAt: Date;
}
