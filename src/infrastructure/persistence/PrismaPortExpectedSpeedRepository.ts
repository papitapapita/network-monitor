import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { IPortExpectedSpeedRepository } from 'domain/device-monitoring/repository';
import { PortExpectedSpeedMapper } from '../mappers';

export class PrismaPortExpectedSpeedRepository
  implements IPortExpectedSpeedRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<PortExpectedSpeed[]>> {
    try {
      const records = await this.prisma.portExpectedSpeed.findMany({
        where: {
          deviceId: { in: deviceIds.map((id) => id.toString()) }
        },
        orderBy: [{ deviceId: 'asc' }, { portName: 'asc' }]
      });
      return Result.ok(records.map(PortExpectedSpeedMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error listing expected port speeds: ${(error as Error).message}`
      );
    }
  }

  async find(
    deviceId: DeviceId,
    portName: string
  ): Promise<Result<PortExpectedSpeed | null>> {
    try {
      const record = await this.prisma.portExpectedSpeed.findUnique({
        where: {
          deviceId_portName: {
            deviceId: deviceId.toString(),
            portName
          }
        }
      });
      return Result.ok(
        record ? PortExpectedSpeedMapper.toDomain(record) : null
      );
    } catch (error) {
      return Result.fail(
        `Database error finding expected port speed: ${(error as Error).message}`
      );
    }
  }

  async saveAll(speeds: PortExpectedSpeed[]): Promise<Result<void>> {
    try {
      await this.prisma.$transaction(
        speeds.map((speed) => {
          const data = PortExpectedSpeedMapper.toPersistence(speed);
          return this.prisma.portExpectedSpeed.upsert({
            where: {
              deviceId_portName: {
                deviceId: data.deviceId,
                portName: data.portName
              }
            },
            create: data,
            update: { expectedMbps: data.expectedMbps }
          });
        })
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving expected port speeds: ${(error as Error).message}`
      );
    }
  }

  async saveCheckState(
    speeds: PortExpectedSpeed[]
  ): Promise<Result<void>> {
    try {
      await this.prisma.$transaction(
        speeds.map((speed) =>
          this.prisma.portExpectedSpeed.updateMany({
            where: { id: speed.id.toString() },
            data: {
              slowChecks: speed.slowChecks,
              alertedAt: speed.alertedAt
            }
          })
        )
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving port speed check state: ${(error as Error).message}`
      );
    }
  }

  async delete(
    deviceId: DeviceId,
    portName: string
  ): Promise<Result<void>> {
    try {
      await this.prisma.portExpectedSpeed.deleteMany({
        where: { deviceId: deviceId.toString(), portName }
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error clearing expected port speed: ${(error as Error).message}`
      );
    }
  }
}
