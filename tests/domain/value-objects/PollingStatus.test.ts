import {
  PollingStatus,
  isValidPollingStatus,
  getPollingStatusDisplayName,
  getPollingStatusColor,
  isDeviceReachable,
  calculatePollingStatus
} from '../../../src/domain/value-objects/PollingStatus';

describe('PollingStatus Enum & Utility Functions', () => {
  // -----------------------------------------------------
  // ENUM VALUES EXISTENCE
  // -----------------------------------------------------
  it('should contain correct enum values', () => {
    expect(PollingStatus.SUCCESS).toBe('SUCCESS');
    expect(PollingStatus.FAILED).toBe('FAILED');
    expect(PollingStatus.TIMEOUT).toBe('TIMEOUT');
    expect(PollingStatus.PARTIAL_SUCCESS).toBe('PARTIAL_SUCCESS');
  });

  // -----------------------------------------------------
  // isValidPollingStatus()
  // -----------------------------------------------------
  describe('isValidPollingStatus', () => {
    it('should return true for valid polling statuses', () => {
      expect(isValidPollingStatus('SUCCESS')).toBe(true);
      expect(isValidPollingStatus('FAILED')).toBe(true);
      expect(isValidPollingStatus('TIMEOUT')).toBe(true);
      expect(isValidPollingStatus('PARTIAL_SUCCESS')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidPollingStatus('INVALID')).toBe(false);
      expect(isValidPollingStatus('')).toBe(false);
      expect(isValidPollingStatus('SUCCESSFUL')).toBe(false);
      expect(isValidPollingStatus('partial_success')).toBe(false);
    });
  });

  // -----------------------------------------------------
  // getPollingStatusDisplayName()
  // -----------------------------------------------------
  describe('getPollingStatusDisplayName', () => {
    it('should return correct display labels', () => {
      expect(getPollingStatusDisplayName(PollingStatus.SUCCESS)).toBe(
        'Success'
      );
      expect(getPollingStatusDisplayName(PollingStatus.FAILED)).toBe(
        'Failed'
      );
      expect(getPollingStatusDisplayName(PollingStatus.TIMEOUT)).toBe(
        'Timeout'
      );
      expect(
        getPollingStatusDisplayName(PollingStatus.PARTIAL_SUCCESS)
      ).toBe('Partial Success');
    });

    it('should return "Unknown" for unrecognized value', () => {
      // @ts-expect-error testing fallback
      expect(getPollingStatusDisplayName('BOGUS')).toBe('Unknown');
    });
  });

  // -----------------------------------------------------
  // getPollingStatusColor()
  // -----------------------------------------------------
  describe('getPollingStatusColor', () => {
    it('should return correct color codes', () => {
      expect(getPollingStatusColor(PollingStatus.SUCCESS)).toBe(
        'green'
      );
      expect(getPollingStatusColor(PollingStatus.FAILED)).toBe('red');
      expect(getPollingStatusColor(PollingStatus.TIMEOUT)).toBe(
        'orange'
      );
      expect(
        getPollingStatusColor(PollingStatus.PARTIAL_SUCCESS)
      ).toBe('yellow');
    });

    it('should return gray for unrecognized value', () => {
      // @ts-expect-error testing fallback
      expect(getPollingStatusColor('BOGUS')).toBe('gray');
    });
  });

  // -----------------------------------------------------
  // isDeviceReachable()
  // -----------------------------------------------------
  describe('isDeviceReachable', () => {
    it('should return true for SUCCESS and PARTIAL_SUCCESS', () => {
      expect(isDeviceReachable(PollingStatus.SUCCESS)).toBe(true);
      expect(isDeviceReachable(PollingStatus.PARTIAL_SUCCESS)).toBe(
        true
      );
    });

    it('should return false for FAILED and TIMEOUT', () => {
      expect(isDeviceReachable(PollingStatus.FAILED)).toBe(false);
      expect(isDeviceReachable(PollingStatus.TIMEOUT)).toBe(false);
    });
  });

  // -----------------------------------------------------
  // calculatePollingStatus()
  // -----------------------------------------------------
  describe('calculatePollingStatus', () => {
    it('should return FAILED when all pings fail', () => {
      expect(calculatePollingStatus(0, 5)).toBe(PollingStatus.FAILED);
    });

    it('should return SUCCESS when all pings succeed', () => {
      expect(calculatePollingStatus(5, 5)).toBe(
        PollingStatus.SUCCESS
      );
    });

    it('should return PARTIAL_SUCCESS when some succeed', () => {
      expect(calculatePollingStatus(3, 5)).toBe(
        PollingStatus.PARTIAL_SUCCESS
      );
    });
  });
});
