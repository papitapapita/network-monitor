import { z } from 'zod';
import {
  ConnectivityType,
  ManagementProtocol,
  NetworkDeviceType
} from '../generated/prisma/client';

export const CreateNetworkDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(NetworkDeviceType),
  description: z.string().optional(),
  ipAddress: z.ipv4(),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
  connectivityType: z.enum(ConnectivityType),
  managementProtocol: z.enum(ManagementProtocol),
  managementPort: z.number().int().min(1).max(65535),
  enabledRemoteAccess: z.boolean().default(false),
  deviceId: z.number().int().positive(),
  installDate: z.date().optional()
});

export const UpdateNetworkDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(NetworkDeviceType).optional(),
  description: z.string().optional(),
  ipAddress: z.ipv4().optional(),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)
    .optional(),
  connectivityType: z.enum(ConnectivityType).optional(),
  managementProtocol: z.enum(ManagementProtocol).optional(),
  managementPort: z.number().int().min(1).max(65535).optional(),
  enabledRemoteAccess: z.boolean().optional()
});

export const ListNetworkDevicesQuerySchema = z.object({
  type: z.enum(NetworkDeviceType).optional(),
  connectivityType: z.enum(ConnectivityType).optional(),
  includeLocation: z.boolean().default(false),
  includeDeviceModel: z.boolean().default(false),
  includeAll: z.boolean().default(false),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20)
});

export type CreateNetworkDeviceDTO = z.infer<
  typeof CreateNetworkDeviceSchema
>;
export type UpdateNetworkDeviceDTO = z.infer<
  typeof UpdateNetworkDeviceSchema
>;
export type ListNetworkDevicesQuery = z.infer<
  typeof ListNetworkDevicesQuerySchema
>;
