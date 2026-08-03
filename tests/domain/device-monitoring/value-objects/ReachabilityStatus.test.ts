// Source: src/domain/device-monitoring/value-objects/ReachabilityStatus.ts

import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';

describe('ReachabilityStatus', () => {

  // ===========================================================================
  describe('create()', () => {
    it('[MON-001] should accept UP', () => {
      const result = ReachabilityStatus.create('UP');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isUp()).toBe(true);
    });

    it('[MON-001] should accept DOWN', () => {
      const result = ReachabilityStatus.create('DOWN');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isDown()).toBe(true);
    });

    it('[MON-001] should accept UNKNOWN', () => {
      const result = ReachabilityStatus.create('UNKNOWN');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isUnknown()).toBe(true);
    });

    it('should upper-case an incoming value', () => {
      const result = ReachabilityStatus.create('up');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('UP');
    });

    it('should trim surrounding whitespace', () => {
      const result = ReachabilityStatus.create('  DOWN  ');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('DOWN');
    });

    it('should reject an empty string with its own message', () => {
      const result = ReachabilityStatus.create('');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Reachability status cannot be empty');
    });

    it('should reject a whitespace-only string before consulting the set', () => {
      const result = ReachabilityStatus.create('   ');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Reachability status cannot be empty');
    });

    it('[MON-001] should reject a value outside the set', () => {
      const result = ReachabilityStatus.create('OFFLINE');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid reachability status: OFFLINE');
      expect(result.error).toContain('UP, DOWN, UNKNOWN');
    });

    it('should reject null', () => {
      const result = ReachabilityStatus.create(null as unknown as string);

      expect(result.isFailure).toBe(true);
    });

    it('should reject a non-string', () => {
      const result = ReachabilityStatus.create(42 as unknown as string);

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('named factories', () => {
    it('should build UP', () => {
      expect(ReachabilityStatus.createUp().value).toBe('UP');
    });

    it('should build DOWN', () => {
      expect(ReachabilityStatus.createDown().value).toBe('DOWN');
    });

    it('should build UNKNOWN', () => {
      expect(ReachabilityStatus.createUnknown().value).toBe('UNKNOWN');
    });
  });

  // ===========================================================================
  describe('isValid()', () => {
    it('should accept the three stored values exactly', () => {
      expect(ReachabilityStatus.isValid('UP')).toBe(true);
      expect(ReachabilityStatus.isValid('DOWN')).toBe(true);
      expect(ReachabilityStatus.isValid('UNKNOWN')).toBe(true);
    });

    it('should reject a value that only matches after normalising, so drift surfaces', () => {
      expect(ReachabilityStatus.isValid('up')).toBe(false);
      expect(ReachabilityStatus.isValid(' UP ')).toBe(false);
    });

    it('should reject an unrecognised value', () => {
      expect(ReachabilityStatus.isValid('ONLINE')).toBe(false);
    });
  });

  // ===========================================================================
  describe('predicates', () => {
    it('should report exactly one predicate true for UP', () => {
      const status = ReachabilityStatus.createUp();

      expect([status.isUp(), status.isDown(), status.isUnknown()])
        .toEqual([true, false, false]);
    });

    it('should report exactly one predicate true for DOWN', () => {
      const status = ReachabilityStatus.createDown();

      expect([status.isUp(), status.isDown(), status.isUnknown()])
        .toEqual([false, true, false]);
    });

    it('[MON-001] should report exactly one predicate true for UNKNOWN', () => {
      const status = ReachabilityStatus.createUnknown();

      expect([status.isUp(), status.isDown(), status.isUnknown()])
        .toEqual([false, false, true]);
    });
  });

  // ===========================================================================
  describe('equality and serialisation', () => {
    it('should treat two instances of the same value as equal', () => {
      expect(ReachabilityStatus.createUp().equals(ReachabilityStatus.createUp()))
        .toBe(true);
    });

    it('should treat different values as unequal', () => {
      expect(ReachabilityStatus.createUp().equals(ReachabilityStatus.createDown()))
        .toBe(false);
    });

    it('[MON-001] should treat UNKNOWN and DOWN as different states', () => {
      expect(ReachabilityStatus.createUnknown().equals(ReachabilityStatus.createDown()))
        .toBe(false);
    });

    it('should serialise to its stored value', () => {
      expect(ReachabilityStatus.createUnknown().toString()).toBe('UNKNOWN');
    });
  });
});
