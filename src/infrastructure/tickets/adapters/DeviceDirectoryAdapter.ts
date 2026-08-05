import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IDeviceDirectory,
  TicketDeviceSummaryDTO
} from 'application/tickets';

/**
 * Anti-corruption layer onto the device-inventory context. Returns the flat
 * summary a technician needs to identify the box, not a Device aggregate.
 */
export class DeviceDirectoryAdapter implements IDeviceDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  public async findSummary(
    deviceId: string
  ): Promise<Result<TicketDeviceSummaryDTO | null>> {
    try {
      const raw = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          ipAddress: true,
          macAddress: true,
          status: true,
          category: true,
          deviceModel: {
            select: {
              model: true,
              vendor: { select: { name: true } }
            }
          },
          location: { select: { name: true } }
        }
      });

      if (!raw) {
        return Result.ok<TicketDeviceSummaryDTO | null>(null);
      }

      return Result.ok<TicketDeviceSummaryDTO | null>({
        id: raw.id,
        name: raw.name,
        ipAddress: raw.ipAddress,
        macAddress: raw.macAddress,
        status: raw.status,
        category: raw.category,
        modelName: raw.deviceModel?.model ?? null,
        vendorName: raw.deviceModel?.vendor?.name ?? null,
        locationName: raw.location?.name ?? null
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<TicketDeviceSummaryDTO | null>(
        `Database error finding device summary: ${errorMessage}`
      );
    }
  }

  public async exists(deviceId: string): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.device.count({
        where: { id: deviceId }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }
}
