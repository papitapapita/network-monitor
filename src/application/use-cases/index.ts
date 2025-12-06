/**
 * Application Use Cases
 *
 * This module exports all use cases for the Network Management System.
 * Use cases orchestrate domain objects to accomplish specific application tasks.
 *
 * Each use case extends the UseCase base class which provides:
 * - Template method pattern
 * - Consistent error handling
 * - Logging
 * - Pre/post execution hooks
 */

// Polling use cases
export {
  ConfigureDevicePollingUseCase,
  ConfigureDevicePollingCommand
} from './ConfigureDevicePollingUseCase';

export {
  GetDevicePollingStatusUseCase,
  GetDevicePollingStatusQuery
} from './GetDevicePollingStatusUseCase';

export {
  GetDevicePollingHistoryUseCase,
  GetDevicePollingHistoryQuery
} from './GetDevicePollingHistoryUseCase';

export {
  ExecutePollingCycleUseCase,
  ExecutePollingCycleCommand
} from './ExecutePollingCycleUseCase';
