// /**
//  * Application Use Cases
//  *
//  * This module exports all use cases for the Network Management System.
//  * Use cases orchestrate domain objects to accomplish specific application tasks.
//  *
//  * Each use case extends the UseCase base class which provides:
//  * - Template method pattern
//  * - Consistent error handling
//  * - Logging
//  * - Pre/post execution hooks
//  */

// // ===================================
// // Network Device CRUD Use Cases (REQ-002)
// // ===================================
// // export { CreateNetworkDeviceUseCase } from './CreateNetworkDeviceUseCase';
// export { DeleteNetworkDeviceUseCase } from './DeleteNetworkDeviceUseCase';
// /**export { UpdateNetworkDeviceUseCase, UpdateNetworkDeviceRequest } from './UpdateNetworkDeviceUseCase';
// export { GetNetworkDeviceUseCase } from './GetNetworkDeviceUseCase';
// export { GetNetworkDeviceByIpUseCase } from './GetNetworkDeviceByIpUseCase';
// export { ListNetworkDevicesUseCase } from './ListNetworkDevicesUseCase';*/

// // REQ-002: Lifecycle Management Use Cases
// export { ActivateNetworkDeviceUseCase } from './ActivateNetworkDeviceUseCase';
// /**export { SoftDeleteNetworkDeviceUseCase } from './SoftDeleteNetworkDeviceUseCase';
// export { RestoreNetworkDeviceUseCase } from './RestoreNetworkDeviceUseCase';*/

// // REQ-002: Bulk Operations Use Cases
// export { BulkImportNetworkDevicesUseCase } from './BulkImportNetworkDevicesUseCase';

// // ===================================
// // Polling Use Cases
// // ===================================
// export { ConfigureDevicePollingUseCase } from '../../device-monitoring/use-cases/ConfigureDevicePollingUseCase';
// /*
// export { GetDevicePollingStatusUseCase } from './GetDevicePollingStatusUseCase';

// export { GetDevicePollingHistoryUseCase } from './GetDevicePollingHistoryUseCase';

// export { ExecutePollingCycleUseCase } from './ExecutePollingCycleUseCase';
// */
export * from './CreateLocationUseCase';
export * from './GetLocationUseCase';
export * from './ListLocationsUseCase';
