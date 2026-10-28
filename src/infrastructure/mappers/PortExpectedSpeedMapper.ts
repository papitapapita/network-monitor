import { DeviceId, PortExpectedSpeedId } from 'domain/shared/ids';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { PortSpeed } from 'domain/device-monitoring/value-objects';

type PrismaPortExpectedSpeedRecord = {
  id: string;
  deviceId: string;
  portName: string;
  expectedMbps: number;
};

export class PortExpectedSpeedMapper {
  public static toDomain(
    raw: PrismaPortExpectedSpeedRecord
  ): PortExpectedSpeed {
    const id = PortExpectedSpeedId.parse(raw.id);
    const deviceId = DeviceId.parse(raw.deviceId);
    if (id.isFailure || deviceId.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id in port_expected_speeds row "${raw.id}"`
      );
    }

    return PortExpectedSpeed.reconstitute(id.value, {
      deviceId: deviceId.value,
      portName: raw.portName,
      expected: PortSpeed.reconstitute({ mbps: raw.expectedMbps })
    });
  }

  public static toPersistence(
    entity: PortExpectedSpeed
  ): PrismaPortExpectedSpeedRecord {
    return {
      id: entity.id.toString(),
      deviceId: entity.deviceId.toString(),
      portName: entity.portName,
      expectedMbps: entity.expected.mbps
    };
  }
}
