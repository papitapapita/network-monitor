// Source: src/infrastructure/mappers/MutedAlertTypeMapper.ts

import { MutedAlertTypeMapper } from '../../../src/infrastructure/mappers/MutedAlertTypeMapper';
import { MutedAlertType } from '../../../src/domain/notifications/entities/MutedAlertType';
import { MutedAlertTypeId } from '../../../src/domain/shared/ids/MutedAlertTypeId';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440101';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('MutedAlertTypeMapper', () => {
  describe('toDomain()', () => {
    it('maps a raw row into a reconstituted entity', () => {
      const entity = MutedAlertTypeMapper.toDomain({
        id: VALID_ID,
        metric: 'cpu_load_percent',
        createdAt: CREATED_AT
      });

      expect(entity.id.toString()).toBe(VALID_ID);
      expect(entity.metric).toBe('cpu_load_percent');
      expect(entity.createdAt).toEqual(CREATED_AT);
    });

    it('throws on a data integrity violation (invalid id)', () => {
      expect(() =>
        MutedAlertTypeMapper.toDomain({
          id: 'not-a-uuid',
          metric: 'cpu_load_percent',
          createdAt: CREATED_AT
        })
      ).toThrow(/Data integrity violation/);
    });
  });

  describe('toPersistence()', () => {
    it('maps a domain entity back to a plain record', () => {
      const entity = MutedAlertType.reconstitute(
        MutedAlertTypeId.parse(VALID_ID).value,
        { metric: 'distance_m', createdAt: CREATED_AT }
      );

      expect(MutedAlertTypeMapper.toPersistence(entity)).toEqual({
        id: VALID_ID,
        metric: 'distance_m',
        createdAt: CREATED_AT
      });
    });
  });
});
