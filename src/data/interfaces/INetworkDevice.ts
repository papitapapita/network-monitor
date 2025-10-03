import { DeviceStatus, DeviceVendor } from '../enums';
import { CommunicationMethod } from './PollerService.interface';
import { DeviceCredential } from './CretentialTypes';

// ============================================================================
// NETWORK DEVICE INTERFACE
// ============================================================================

/**
 * Core Network Device entity
 * Represents a network device (Access Point, Router, Switch, etc.) that can be monitored
 */
export interface NetworkDevice {
  /** Unique internal identifier */
  id: string; // UUID

  /** Human-readable name assigned by admin */
  hostname: string | null;

  /** Primary IP address used for polling (IPv4 or IPv6) */
  ipAddress: string;

  /** Device vendor */
  vendor: DeviceVendor;

  /** Optional device model (e.g., "hAP ac²", "UniFi AP AC Pro") */
  model: string | null;

  /** Preferred polling protocol */
  protocol: CommunicationMethod;

  /** Device credentials (can be a reference ID to a secured credentials store) */
  credentials: DeviceCredential | string; // string = credentialId reference

  /** Polling interval in seconds (null = use global default) */
  pollingIntervalSeconds: number | null;

  /** Real-time cached status */
  status: DeviceStatus;

  /** Last successful poll timestamp (ISO 8601) */
  lastPolledAt: string | null;

  /** Last response time in milliseconds */
  lastResponseTimeMs: number | null;

  /** Whether polling is active for this device */
  enabled: boolean;

  /** Optional location/grouping info (rack, customer, site, building, etc.) */
  location: string | null;

  /** Extra vendor-specific or integrator-specific metadata */
  metadata: Record<string, unknown>;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// ============================================================================

/**
 * DTO for creating a new network device
 */
export interface CreateNetworkDeviceDTO {
  hostname?: string;
  ipAddress: string;
  vendor: DeviceVendor;
  model?: string;
  protocol: CommunicationMethod;
  credentials: DeviceCredential | string;
  pollingIntervalSeconds?: number;
  enabled?: boolean; // default: true
  location?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing network device
 */
export interface UpdateNetworkDeviceDTO {
  hostname?: string;
  ipAddress?: string;
  vendor?: DeviceVendor;
  model?: string;
  protocol?: CommunicationMethod;
  credentials?: DeviceCredential | string;
  pollingIntervalSeconds?: number;
  enabled?: boolean;
  location?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for patching device status (used by polling service)
 */
export interface PatchDeviceStatusDTO {
  status: DeviceStatus;
  lastPolledAt: string;
  lastResponseTimeMs: number | null;
}

// ============================================================================
// QUERY/FILTER TYPES
// ============================================================================

/**
 * Filter options for querying network devices
 */
export interface NetworkDeviceFilter {
  vendor?: DeviceVendor | DeviceVendor[];
  protocol?: CommunicationMethod | CommunicationMethod[];
  status?: DeviceStatus | DeviceStatus[];
  enabled?: boolean;
  location?: string | string[];
  search?: string; // Search in hostname, ipAddress, model
}

/**
 * Sorting options
 */
export interface NetworkDeviceSortOptions {
  field:
    | 'hostname'
    | 'ipAddress'
    | 'status'
    | 'lastPolledAt'
    | 'lastResponseTimeMs'
    | 'createdAt';
  order: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number; // 1-based
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

/**
 * Repository interface for Network Device persistence
 * Defines the contract for data access operations
 */
export interface INetworkDeviceRepository {
  /**
   * Create a new network device
   */
  create(dto: CreateNetworkDeviceDTO): Promise<NetworkDevice>;

  /**
   * Find a device by ID
   */
  findById(id: string): Promise<NetworkDevice | null>;

  /**
   * Find a device by IP address
   */
  findByIpAddress(ipAddress: string): Promise<NetworkDevice | null>;

  /**
   * Find multiple devices by IDs
   */
  findByIds(ids: string[]): Promise<NetworkDevice[]>;

  /**
   * Find all devices with optional filtering, sorting, and pagination
   */
  findAll(
    filter?: NetworkDeviceFilter,
    sort?: NetworkDeviceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<NetworkDevice>>;

  /**
   * Find all enabled devices ready for polling
   */
  findAllEnabled(): Promise<NetworkDevice[]>;

  /**
   * Update a device
   */
  update(
    id: string,
    dto: UpdateNetworkDeviceDTO
  ): Promise<NetworkDevice>;

  /**
   * Patch device status (lightweight update used by poller)
   */
  patchStatus(id: string, dto: PatchDeviceStatusDTO): Promise<void>;

  /**
   * Batch patch device statuses
   */
  batchPatchStatus(
    updates: Array<{ id: string; status: PatchDeviceStatusDTO }>
  ): Promise<void>;

  /**
   * Delete a device
   */
  delete(id: string): Promise<void>;

  /**
   * Batch delete devices
   */
  batchDelete(ids: string[]): Promise<void>;

  /**
   * Count devices matching filter
   */
  count(filter?: NetworkDeviceFilter): Promise<number>;

  /**
   * Check if IP address exists (for uniqueness validation)
   */
  existsByIpAddress(
    ipAddress: string,
    excludeId?: string
  ): Promise<boolean>;
}

// ============================================================================
// DOMAIN SERVICE INTERFACE
// ============================================================================

/**
 * Domain service for Network Device business logic
 */
export interface INetworkDeviceService {
  /**
   * Create a new device with validation
   */
  createDevice(dto: CreateNetworkDeviceDTO): Promise<NetworkDevice>;

  /**
   * Get device by ID
   */
  getDeviceById(id: string): Promise<NetworkDevice>;

  /**
   * Get device by IP address
   */
  getDeviceByIpAddress(ipAddress: string): Promise<NetworkDevice>;

  /**
   * List devices with filtering and pagination
   */
  listDevices(
    filter?: NetworkDeviceFilter,
    sort?: NetworkDeviceSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<NetworkDevice>>;

  /**
   * Update device
   */
  updateDevice(
    id: string,
    dto: UpdateNetworkDeviceDTO
  ): Promise<NetworkDevice>;

  /**
   * Delete device
   */
  deleteDevice(id: string): Promise<void>;

  /**
   * Enable/disable device
   */
  toggleDevice(id: string, enabled: boolean): Promise<NetworkDevice>;

  /**
   * Bulk enable/disable devices
   */
  bulkToggleDevices(ids: string[], enabled: boolean): Promise<void>;

  /**
   * Update device status from polling results
   */
  updateDeviceStatus(
    id: string,
    status: PatchDeviceStatusDTO
  ): Promise<void>;

  /**
   * Get devices by location
   */
  getDevicesByLocation(location: string): Promise<NetworkDevice[]>;

  /**
   * Get device statistics
   */
  getDeviceStats(): Promise<NetworkDeviceStats>;
}

/**
 * Device statistics
 */
export interface NetworkDeviceStats {
  total: number;
  enabled: number;
  disabled: number;
  byStatus: Record<DeviceStatus, number>;
  byVendor: Record<DeviceVendor, number>;
  byProtocol: Record<CommunicationMethod, number>;
  averageResponseTime: number | null;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validator interface for network devices
 */
export interface INetworkDeviceValidator {
  /**
   * Validate create DTO
   */
  validateCreate(
    dto: CreateNetworkDeviceDTO
  ): Promise<ValidationResult>;

  /**
   * Validate update DTO
   */
  validateUpdate(
    dto: UpdateNetworkDeviceDTO
  ): Promise<ValidationResult>;

  /**
   * Validate IP address format
   */
  validateIpAddress(ipAddress: string): boolean;

  /**
   * Validate credentials for given protocol
   */
  validateCredentials(
    protocol: CommunicationMethod,
    credentials: DeviceCredential
  ): ValidationResult;
}
