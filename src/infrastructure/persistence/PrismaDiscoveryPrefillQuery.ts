import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IDiscoveryPrefillQuery,
  PrefillAccessPoint,
  PrefillModel
} from 'application/device-inventory/interfaces';

export class PrismaDiscoveryPrefillQuery
  implements IDiscoveryPrefillQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async findAccessPoint(
    deviceId: string
  ): Promise<Result<PrefillAccessPoint | null>> {
    try {
      const ap = await this.prisma.device.findFirst({
        where: { id: deviceId, deletedAt: null },
        select: { id: true, agentId: true }
      });
      return Result.ok(
        ap ? { deviceId: ap.id, agentId: ap.agentId } : null
      );
    } catch (error) {
      return Result.fail(
        `Database error loading the access point: ${(error as Error).message}`
      );
    }
  }

  // Names compare as bare lower-case letters and digits, as the wireless
  // hardware check does (WLS-155): AirOS and the catalog spell them apart.
  async guessModel(
    reported: string
  ): Promise<Result<PrefillModel | null>> {
    try {
      const byName = await this.prisma.$queryRaw<PrefillModel[]>`
        SELECT id::text, model
        FROM device_models
        WHERE regexp_replace(lower(model), '[^a-z0-9]', '', 'g') =
              regexp_replace(lower(${reported}), '[^a-z0-9]', '', 'g')
        ORDER BY model, id
        LIMIT 1
      `;
      if (byName[0]) return Result.ok(byName[0]);

      const confirmed = await this.prisma.$queryRaw<PrefillModel[]>`
        SELECT DISTINCT m.id::text, m.model
        FROM (
          SELECT DISTINCT ON (device_id) device_id, mac_address, device_model
          FROM wireless_snapshots
          ORDER BY device_id, collected_at DESC
        ) s
        JOIN devices d ON d.id = s.device_id
        JOIN device_models m ON m.id = d.device_model_id
        WHERE d.deleted_at IS NULL
          AND regexp_replace(lower(s.device_model), '[^a-z0-9]', '', 'g') =
              regexp_replace(lower(${reported}), '[^a-z0-9]', '', 'g')
          AND upper(regexp_replace(s.mac_address, '[^0-9A-Fa-f]', '', 'g')) =
              upper(regexp_replace(d.mac_address, '[^0-9A-Fa-f]', '', 'g'))
      `;
      return Result.ok(confirmed.length === 1 ? confirmed[0]! : null);
    } catch (error) {
      return Result.fail(
        `Database error guessing the model: ${(error as Error).message}`
      );
    }
  }
}
