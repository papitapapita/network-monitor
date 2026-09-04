// Source: src/domain/notifications/entities/MutedAlertType.ts

import { MutedAlertType } from '../../../../src/domain/notifications/entities/MutedAlertType';
import { MutedAlertTypeId } from '../../../../src/domain/shared/ids/MutedAlertTypeId';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440102';

describe('MutedAlertType', () => {
  describe('create()', () => {
    it('should create a valid entity for a well-formed metric', () => {
      const result = MutedAlertType.create('cpu_load_percent');

      expect(result.isSuccess).toBe(true);
      expect(result.value.metric).toBe('cpu_load_percent');
    });

    it('should trim surrounding whitespace', () => {
      const result = MutedAlertType.create('  distance_m  ');

      expect(result.isSuccess).toBe(true);
      expect(result.value.metric).toBe('distance_m');
    });

    it('should fail on an empty string', () => {
      const result = MutedAlertType.create('');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('required');
    });

    it('should fail on whitespace only', () => {
      const result = MutedAlertType.create('   ');
      expect(result.isFailure).toBe(true);
    });

    it('should fail on a value with spaces', () => {
      const result = MutedAlertType.create('cpu load percent');
      expect(result.isFailure).toBe(true);
    });

    it('should fail on an uppercase value', () => {
      const result = MutedAlertType.create('CPU_LOAD_PERCENT');
      expect(result.isFailure).toBe(true);
    });

    it('should fail on a value starting with a digit', () => {
      const result = MutedAlertType.create('1cpu');
      expect(result.isFailure).toBe(true);
    });

    it('should accept a full wireless-style type string too', () => {
      // The bare-metric convention is a MutedTypeAlertPublisher decision, not
      // a domain one — the entity itself only validates the character set.
      const result = MutedAlertType.create(
        'wireless_cpu_load_percent_critical'
      );
      expect(result.isSuccess).toBe(true);
    });

    it('should assign a generated id when none is supplied', () => {
      const result = MutedAlertType.create('cpu_load_percent');
      expect(result.value.id).toBeDefined();
    });

    it('should use a supplied id', () => {
      const id = MutedAlertTypeId.parse(VALID_ID).value;
      const result = MutedAlertType.create('cpu_load_percent', id);
      expect(result.value.id.toString()).toBe(VALID_ID);
    });
  });

  describe('reconstitute()', () => {
    it('should bypass validation, preserving props as-is', () => {
      const id = MutedAlertTypeId.parse(VALID_ID).value;
      const createdAt = new Date('2026-01-01T00:00:00.000Z');

      const entity = MutedAlertType.reconstitute(id, {
        metric: 'cpu_load_percent',
        createdAt
      });

      expect(entity.metric).toBe('cpu_load_percent');
      expect(entity.createdAt).toEqual(createdAt);
    });
  });
});
