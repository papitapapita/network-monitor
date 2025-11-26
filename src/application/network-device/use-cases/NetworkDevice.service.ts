import {
  PrismaClient,
  NetworkDevice,
  NetworkDeviceType,
  NetworkDeviceStatus
} from '../generated/prisma/client';
import { EventEmitter } from 'events';
import {
  CreateNetworkDeviceSchema,
  UpdateNetworkDeviceSchema,
  ListNetworkDevicesQuerySchema,
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO,
  ListNetworkDevicesQuery,
  LinkAntennaSchema,
  LinkAntennaDTO
} from '../application/http/validators';
import { NetworkDeviceError } from '../shared/errors/networkDevice.errors';
import { NetworkDeviceEventType } from '../events/networkDevice.events';

// ==================== Service ====================

export class NetworkDeviceService {
  private prisma: PrismaClient;
  private eventEmitter: EventEmitter;

  constructor(prisma: PrismaClient, eventEmitter?: EventEmitter) {
    this.prisma = prisma;
    this.eventEmitter = eventEmitter || new EventEmitter();
  }

  // ==================== CRUD Operations ====================

  /**
   * Create a new network device with validation
   */
  async create(data: CreateNetworkDeviceDTO): Promise<NetworkDevice> {
    const validated = CreateNetworkDeviceSchema.parse(data);

    await this.validateDevice(validated.deviceId);

    await this.validateDeviceModelCompatibility(
      validated.deviceId,
      validated.type
    );

    await this.checkUniquenessConstraints(
      validated.ipAddress,
      validated.macAddress
    );

    await this.checkDeviceNotLinked(validated.deviceId);

    try {
      const networkDevice = await this.prisma.networkDevice.create({
        data: {
          name: validated.name,
          type: validated.type,
          description: validated.description,
          ipAddress: validated.ipAddress,
          macAddress: validated.macAddress,
          connectivityType: validated.connectivityType,
          managementProtocol: validated.managementProtocol,
          managementPort: validated.managementPort,
          enabledRemoteAccess: validated.enabledRemoteAccess,
          installDate: validated.installDate || new Date(),
          deviceId: validated.deviceId
        },
        include: this.getDefaultIncludes()
      });

      // Emit event
      this.eventEmitter.emit(
        NetworkDeviceEventType.CREATED,
        networkDevice
      );

      return networkDevice;
    } catch (error: any) {
      throw new NetworkDeviceError(
        `Failed to create network device: ${error.message}`,
        'CREATE_FAILED'
      );
    }
  }

  /**
   * Read network device by ID with optional relations
   */
  async findById(
    id: number,
    options?: {
      includeLocation?: boolean;
      includeDeviceModel?: boolean;
      includeAll?: boolean;
    }
  ): Promise<NetworkDevice | null> {
    const include = this.buildIncludeOptions(options);

    return this.prisma.networkDevice.findUnique({
      where: { id },
      include
    });
  }

  /**
   * Read network device by device ID
   */
  async findByDeviceId(
    deviceId: number
  ): Promise<NetworkDevice | null> {
    return this.prisma.networkDevice.findUnique({
      where: { deviceId },
      include: this.getDefaultIncludes()
    });
  }

  /**
   * List network devices with filtering and pagination
   */
  async list(query: ListNetworkDevicesQuery) {
    const validated = ListNetworkDevicesQuerySchema.parse(query);

    const where: any = {};
    if (validated.type) where.type = validated.type;
    if (validated.connectivityType)
      where.connectivityType = validated.connectivityType;

    const include = this.buildIncludeOptions({
      includeLocation: validated.includeLocation,
      includeDeviceModel: validated.includeDeviceModel,
      includeAll: validated.includeAll
    });

    const [devices, total] = await Promise.all([
      this.prisma.networkDevice.findMany({
        where,
        include,
        skip: validated.skip,
        take: validated.take,
        orderBy: { id: 'desc' }
      }),
      this.prisma.networkDevice.count({ where })
    ]);

    return {
      devices,
      total,
      page: Math.floor(validated.skip / validated.take) + 1,
      pageSize: validated.take,
      totalPages: Math.ceil(total / validated.take)
    };
  }

  /**
   * Update network device properties
   */
  async update(
    id: number,
    data: UpdateNetworkDeviceDTO
  ): Promise<NetworkDevice> {
    const validated = UpdateNetworkDeviceSchema.parse(data);

    // Check if device exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new NetworkDeviceError(
        'Network device not found',
        'NOT_FOUND'
      );
    }

    // Check uniqueness if IP or MAC is being updated
    if (
      validated.ipAddress &&
      validated.ipAddress !== existing.ipAddress
    ) {
      await this.checkIpUniqueness(validated.ipAddress);
    }
    if (
      validated.macAddress &&
      validated.macAddress !== existing.macAddress
    ) {
      await this.checkMacUniqueness(validated.macAddress);
    }

    // Validate device model compatibility if type is changing
    if (validated.type && validated.type !== existing.type) {
      await this.validateDeviceModelCompatibility(
        existing.deviceId,
        validated.type
      );
    }

    try {
      const updated = await this.prisma.networkDevice.update({
        where: { id },
        data: validated,
        include: this.getDefaultIncludes()
      });

      this.eventEmitter.emit(NetworkDeviceEventType.UPDATED, updated);

      return updated;
    } catch (error: any) {
      throw new NetworkDeviceError(
        `Failed to update network device: ${error.message}`,
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * Soft delete network device (mark as inactive in base Device)
   */
  async delete(id: number): Promise<void> {
    const networkDevice = await this.findById(id);
    if (!networkDevice) {
      throw new NetworkDeviceError(
        'Network device not found',
        'NOT_FOUND'
      );
    }

    try {
      // Soft delete by updating the base device status
      await this.prisma.device.update({
        where: { id: networkDevice.deviceId },
        data: { status: 'OUT_OF_SERVICE' }
      });

      this.eventEmitter.emit(NetworkDeviceEventType.DELETED, {
        id,
        deviceId: networkDevice.deviceId
      });
    } catch (error: any) {
      throw new NetworkDeviceError(
        `Failed to delete network device: ${error.message}`,
        'DELETE_FAILED'
      );
    }
  }

  // ==================== Device Composition & Relations ====================

  /**
   * Link a radio antenna to network device
   */
  async linkRadioAntenna(data: LinkAntennaDTO): Promise<void> {
    const validated = LinkAntennaSchema.parse(data);

    const networkDevice = await this.findById(
      validated.networkDeviceId
    );
    if (!networkDevice) {
      throw new NetworkDeviceError(
        'Network device not found',
        'NOT_FOUND'
      );
    }

    // Validate: wireless access points should have antennas
    if (
      networkDevice.type ===
        NetworkDeviceType.WIRELESS_ACCESS_POINT ||
      networkDevice.type === NetworkDeviceType.ACCESS_POINT
    ) {
      // Allowed
    } else if (
      networkDevice.type === NetworkDeviceType.ACCESS_SWITCH ||
      networkDevice.type === NetworkDeviceType.CORE_ROUTER
    ) {
      throw new NetworkDeviceError(
        'This device type cannot have a radio antenna',
        'INVALID_ANTENNA_ASSIGNMENT'
      );
    }

    // Check if antenna already exists
    const existingAntenna = await this.prisma.radioAntenna.findUnique(
      {
        where: { networkDeviceId: validated.networkDeviceId }
      }
    );

    if (existingAntenna) {
      throw new NetworkDeviceError(
        'Network device already has a radio antenna',
        'ANTENNA_ALREADY_EXISTS'
      );
    }

    try {
      await this.prisma.radioAntenna.create({
        data: {
          power: validated.power,
          antennaGain: validated.antennaGain,
          height: validated.height,
          frequencyRange: validated.frequencyRange,
          type: validated.type,
          networkDeviceId: validated.networkDeviceId
        }
      });

      this.eventEmitter.emit(
        NetworkDeviceEventType.RELATIONSHIP_CHANGED,
        {
          networkDeviceId: validated.networkDeviceId,
          relationship: 'radioAntenna',
          action: 'linked'
        }
      );
    } catch (error: any) {
      throw new NetworkDeviceError(
        `Failed to link radio antenna: ${error.message}`,
        'LINK_ANTENNA_FAILED'
      );
    }
  }

  /**
   * Get device with all subcomponents
   */
  async getDeviceWithAllComponents(id: number) {
    return this.prisma.networkDevice.findUnique({
      where: { id },
      include: {
        device: {
          include: {
            deviceModel: true,
            location: true,
            purchaseOrders: true
          }
        },
        radioAntenna: {
          include: {
            accessPoint: {
              include: {
                link: true
              }
            },
            link: true
          }
        },
        deviceSoftware: true,
        deviceSecurity: true,
        deviceEnergy: true,
        deviceMonitoring: true,
        deviceLogs: {
          orderBy: { timestamp: 'desc' },
          take: 50
        },
        deviceMaintenanceLogs: {
          include: {
            performedBy: true
          },
          orderBy: { date: 'desc' }
        }
      }
    });
  }

  /**
   * Get radio links for a network device
   */
  async getRadioLinks(networkDeviceId: number) {
    const device = await this.prisma.networkDevice.findUnique({
      where: { id: networkDeviceId },
      include: {
        radioAntenna: {
          include: {
            accessPoint: {
              include: {
                link: {
                  include: {
                    destinationDevice: {
                      include: {
                        networkDevice: true
                      }
                    }
                  }
                }
              }
            },
            link: {
              include: {
                sourceDevice: {
                  include: {
                    radioAntenna: {
                      include: {
                        networkDevice: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!device || !device.radioAntenna) {
      return [];
    }

    const links = [];

    // Outgoing links (device is source)
    if (device.radioAntenna.accessPoint?.link) {
      links.push({
        direction: 'outgoing',
        link: device.radioAntenna.accessPoint.link
      });
    }

    // Incoming links (device is destination)
    if (device.radioAntenna.link) {
      links.push({
        direction: 'incoming',
        link: device.radioAntenna.link
      });
    }

    return links;
  }

  /**
   * Get full topology node information
   */
  async getTopologyNode(networkDeviceId: number) {
    const device =
      await this.getDeviceWithAllComponents(networkDeviceId);
    if (!device) {
      throw new NetworkDeviceError(
        'Network device not found',
        'NOT_FOUND'
      );
    }

    const links = await this.getRadioLinks(networkDeviceId);

    return {
      device,
      links,
      status:
        device.deviceMonitoring?.status ||
        NetworkDeviceStatus.OFFLINE,
      location: device.device.location
    };
  }

  // ==================== Status Coordination ====================

  /**
   * Update device status (called by MonitoringService)
   */
  async updateStatus(
    networkDeviceId: number,
    status: NetworkDeviceStatus
  ): Promise<void> {
    const device = await this.findById(networkDeviceId);
    if (!device) {
      throw new NetworkDeviceError(
        'Network device not found',
        'NOT_FOUND'
      );
    }

    try {
      // Update in DeviceMonitoring if exists
      const monitoring =
        await this.prisma.deviceMonitoring.findUnique({
          where: { networkDeviceId }
        });

      if (monitoring) {
        await this.prisma.deviceMonitoring.update({
          where: { networkDeviceId },
          data: { status }
        });
      }

      this.eventEmitter.emit(NetworkDeviceEventType.UPDATED, {
        networkDeviceId,
        statusChange: { old: monitoring?.status, new: status }
      });
    } catch (error: any) {
      throw new NetworkDeviceError(
        `Failed to update status: ${error.message}`,
        'STATUS_UPDATE_FAILED'
      );
    }
  }

  // ==================== Validation Methods ====================

  private async validateDevice(deviceId: number): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      throw new NetworkDeviceError(
        'Device not found',
        'DEVICE_NOT_FOUND'
      );
    }

    if (
      device.status !== 'ACTIVE' &&
      device.status !== 'MAINTENANCE'
    ) {
      throw new NetworkDeviceError(
        'Device must be ACTIVE or in MAINTENANCE',
        'INVALID_DEVICE_STATUS'
      );
    }
  }

  private async validateDeviceModelCompatibility(
    deviceId: number,
    networkType: NetworkDeviceType
  ): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { deviceModel: true }
    });

    if (!device) {
      throw new NetworkDeviceError(
        'Device not found',
        'DEVICE_NOT_FOUND'
      );
    }

    // Type compatibility rules
    const wirelessTypes = [
      NetworkDeviceType.WIRELESS_ACCESS_POINT,
      NetworkDeviceType.ACCESS_POINT
    ];

    if (wirelessTypes.includes(networkType)) {
      // Could add more sophisticated checks based on device model
      // For now, just ensure it exists
    }
  }

  private async checkUniquenessConstraints(
    ipAddress: string,
    macAddress: string
  ): Promise<void> {
    await Promise.all([
      this.checkIpUniqueness(ipAddress),
      this.checkMacUniqueness(macAddress)
    ]);
  }

  private async checkIpUniqueness(ipAddress: string): Promise<void> {
    const existing = await this.prisma.networkDevice.findUnique({
      where: { ipAddress }
    });

    if (existing) {
      throw new NetworkDeviceError(
        'IP address already in use',
        'IP_NOT_UNIQUE'
      );
    }
  }

  private async checkMacUniqueness(
    macAddress: string
  ): Promise<void> {
    const existing = await this.prisma.networkDevice.findUnique({
      where: { macAddress }
    });

    if (existing) {
      throw new NetworkDeviceError(
        'MAC address already in use',
        'MAC_NOT_UNIQUE'
      );
    }
  }

  private async checkDeviceNotLinked(
    deviceId: number
  ): Promise<void> {
    const existing = await this.prisma.networkDevice.findUnique({
      where: { deviceId }
    });

    if (existing) {
      throw new NetworkDeviceError(
        'Device is already linked to a network device',
        'DEVICE_ALREADY_LINKED'
      );
    }
  }

  // ==================== Helper Methods ====================

  private getDefaultIncludes() {
    return {
      device: {
        include: {
          deviceModel: true
        }
      },
      radioAntenna: true,
      deviceSoftware: true,
      deviceMonitoring: true
    };
  }

  private buildIncludeOptions(options?: {
    includeLocation?: boolean;
    includeDeviceModel?: boolean;
    includeAll?: boolean;
  }) {
    if (options?.includeAll) {
      return {
        device: {
          include: {
            deviceModel: true,
            location: true,
            purchaseOrders: true
          }
        },
        radioAntenna: {
          include: {
            accessPoint: true,
            link: true
          }
        },
        deviceSoftware: true,
        deviceSecurity: true,
        deviceEnergy: true,
        deviceMonitoring: true,
        deviceLogs: true,
        deviceMaintenanceLogs: {
          include: {
            performedBy: true
          }
        }
      };
    }

    return {
      device: {
        include: {
          deviceModel: options?.includeDeviceModel || false,
          location: options?.includeLocation || false
        }
      },
      radioAntenna: true,
      deviceMonitoring: true
    };
  }

  // ==================== Event Emitter Access ====================

  public on(
    event: NetworkDeviceEventType,
    listener: (...args: any[]) => void
  ): void {
    this.eventEmitter.on(event, listener);
  }

  public off(
    event: NetworkDeviceEventType,
    listener: (...args: any[]) => void
  ): void {
    this.eventEmitter.off(event, listener);
  }
}
