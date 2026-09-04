import { MutedAlertTypeId } from 'domain/shared/ids';
import { MutedAlertType } from 'domain/notifications/entities';

type PrismaMutedAlertTypeRecord = {
  id: string;
  metric: string;
  createdAt: Date;
};

export class MutedAlertTypeMapper {
  public static toDomain(
    raw: PrismaMutedAlertTypeRecord
  ): MutedAlertType {
    const idResult = MutedAlertTypeId.parse(raw.id);
    if (idResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in muted_alert_types`
      );
    }

    return MutedAlertType.reconstitute(idResult.value, {
      metric: raw.metric,
      createdAt: raw.createdAt
    });
  }

  public static toPersistence(
    entity: MutedAlertType
  ): PrismaMutedAlertTypeRecord {
    return {
      id: entity.id.toString(),
      metric: entity.metric,
      createdAt: entity.createdAt
    };
  }
}
