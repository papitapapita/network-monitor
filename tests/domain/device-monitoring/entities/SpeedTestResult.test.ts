// Source: src/domain/device-monitoring/entities/SpeedTestResult.ts

import {
  SpeedTestResult,
  SpeedTestResultInput
} from '../../../../src/domain/device-monitoring/entities/SpeedTestResult';

const STARTED_AT = new Date('2026-10-27T14:00:00Z');
const FINISHED_AT = new Date('2026-10-27T14:00:25Z');

function makeInput(
  overrides: Partial<SpeedTestResultInput> = {}
): SpeedTestResultInput {
  return {
    downloadMbps: 95.4,
    uploadMbps: 42.1,
    latencyMs: 8.2,
    jitterMs: 1.3,
    serverLocation: 'BOG',
    startedById: '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60',
    startedByEmail: 'operator@example.local',
    startedAt: STARTED_AT,
    finishedAt: FINISHED_AT,
    ...overrides
  };
}

describe('SpeedTestResult', () => {
  describe('create', () => {
    it('is COMPLETED when every measure is present and there is no error', () => {
      const result = SpeedTestResult.create(makeInput());

      expect(result.isSuccess).toBe(true);
      const test = result.value;
      expect(test.status).toBe('COMPLETED');
      expect(test.downloadMbps).toBe(95.4);
      expect(test.uploadMbps).toBe(42.1);
      expect(test.latencyMs).toBe(8.2);
      expect(test.jitterMs).toBe(1.3);
      expect(test.serverLocation).toBe('BOG');
      expect(test.error).toBeNull();
      expect(test.startedByEmail).toBe('operator@example.local');
    });

    it('is FAILED when an error is given, keeping what was measured', () => {
      const result = SpeedTestResult.create(
        makeInput({ uploadMbps: null, error: 'Upload failed: reset' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('FAILED');
      expect(result.value.downloadMbps).toBe(95.4);
      expect(result.value.uploadMbps).toBeNull();
      expect(result.value.error).toBe('Upload failed: reset');
    });

    it('accepts a failure that measured nothing', () => {
      const result = SpeedTestResult.create(
        makeInput({
          downloadMbps: null,
          uploadMbps: null,
          latencyMs: null,
          jitterMs: null,
          serverLocation: null,
          error: 'Latency failed: the server did not answer'
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('FAILED');
    });

    it('rejects a result with a missing measure and no error', () => {
      const result = SpeedTestResult.create(
        makeInput({ uploadMbps: null })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'a speed test without an error must have every measure'
      );
    });

    it('treats a blank error as no error', () => {
      const result = SpeedTestResult.create(
        makeInput({ error: '   ' })
      );

      expect(result.value.status).toBe('COMPLETED');
      expect(result.value.error).toBeNull();
    });

    it.each([
      ['downloadMbps', -1],
      ['uploadMbps', Number.NaN],
      ['latencyMs', Number.POSITIVE_INFINITY],
      ['jitterMs', -0.1]
    ])('rejects %s of %p', (field, value) => {
      const result = SpeedTestResult.create(
        makeInput({ [field]: value })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        `${field} must be a number of 0 or more`
      );
    });

    it('rejects a finish before the start', () => {
      const result = SpeedTestResult.create(
        makeInput({ finishedAt: new Date('2026-10-27T13:59:59Z') })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'finishedAt must not be before startedAt'
      );
    });

    it('rejects an invalid date', () => {
      const result = SpeedTestResult.create(
        makeInput({ startedAt: new Date('nope') })
      );

      expect(result.error).toBe('startedAt must be a valid date');
    });

    it('requires who started it', () => {
      expect(
        SpeedTestResult.create(makeInput({ startedByEmail: '  ' }))
          .error
      ).toBe('startedByEmail is required');
    });

    it('rejects an error longer than 500 characters', () => {
      const result = SpeedTestResult.create(
        makeInput({ error: 'x'.repeat(501) })
      );

      expect(result.error).toBe(
        'error must be at most 500 characters'
      );
    });

    it('rejects a server location longer than 50 characters', () => {
      const result = SpeedTestResult.create(
        makeInput({ serverLocation: 'x'.repeat(51) })
      );

      expect(result.error).toBe(
        'serverLocation must be at most 50 characters'
      );
    });

    it('keeps no user id when none is given', () => {
      const result = SpeedTestResult.create(
        makeInput({ startedById: null })
      );

      expect(result.value.startedById).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('restores the props without validating them', () => {
      const created = SpeedTestResult.create(makeInput()).value;
      const restored = SpeedTestResult.reconstitute(created.id, {
        status: 'COMPLETED',
        downloadMbps: -5,
        uploadMbps: null,
        latencyMs: null,
        jitterMs: null,
        serverLocation: null,
        error: null,
        startedById: null,
        startedByEmail: 'x@example.local',
        startedAt: STARTED_AT,
        finishedAt: FINISHED_AT
      });

      expect(restored.id.equals(created.id)).toBe(true);
      expect(restored.downloadMbps).toBe(-5);
    });
  });
});
