import { PollingInterval } from '../../../src/domain';

describe('PollingInterval Value Object', () => {
  // ---------- CREATE ----------
  it('should create successfully with valid seconds', () => {
    const result = PollingInterval.create(60);

    expect(result.isSuccess).toBe(true);
    expect(result.value.seconds).toBe(60);
  });

  it('should round decimal seconds', () => {
    const result = PollingInterval.create(60.7);

    expect(result.isSuccess).toBe(true);
    expect(result.value.seconds).toBe(61);
  });

  it('should fail if seconds is below minimum', () => {
    const result = PollingInterval.create(0);
    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('polling interval');
  });

  it('should fail if seconds exceed maximum (24hrs)', () => {
    const result = PollingInterval.create(90000);
    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('polling interval');
  });

  it('should fail if seconds is not a number', () => {
    // @ts-ignore intentional wrong type
    const result = PollingInterval.create('not-a-number');
    expect(result.isSuccess).toBe(false);
  });

  // ---------- FROM MINUTES ----------
  it('should create interval from minutes', () => {
    const result = PollingInterval.fromMinutes(5);

    expect(result.isSuccess).toBe(true);
    expect(result.value.seconds).toBe(300);
  });

  it('should fail if minutes is null or undefined', () => {
    // @ts-ignore
    const result = PollingInterval.fromMinutes(undefined);

    expect(result.isSuccess).toBe(false);
  });

  it('should fail if minutes produces seconds outside range', () => {
    const result = PollingInterval.fromMinutes(2000); // Too large
    expect(result.isSuccess).toBe(false);
  });

  // ---------- FROM HOURS ----------
  it('should create interval from hours', () => {
    const result = PollingInterval.fromHours(1);

    expect(result.isSuccess).toBe(true);
    expect(result.value.seconds).toBe(3600);
  });

  it('should fail if hours is null or undefined', () => {
    // @ts-ignore
    const result = PollingInterval.fromHours(null);
    expect(result.isSuccess).toBe(false);
  });

  it('should fail if hours produces invalid seconds', () => {
    const result = PollingInterval.fromHours(48);
    expect(result.isSuccess).toBe(false);
  });

  // ---------- CONVERSIONS ----------
  it('should convert to milliseconds', () => {
    const interval = PollingInterval.create(10).value;

    expect(interval.toMilliseconds()).toBe(10000);
  });

  it('should convert to minutes', () => {
    const interval = PollingInterval.create(90).value;

    expect(interval.toMinutes()).toBe(1.5);
  });

  it('should convert to hours', () => {
    const interval = PollingInterval.create(7200).value;

    expect(interval.toHours()).toBe(2);
  });

  // ---------- DISPLAY STRING ----------
  it('should display in seconds correctly', () => {
    const interval = PollingInterval.create(45).value;

    expect(interval.toDisplayString()).toBe('45 seconds');
  });

  it('should display in minutes correctly', () => {
    const interval = PollingInterval.create(120).value;

    expect(interval.toDisplayString()).toBe('2 minutes');
  });

  it('should display in hours correctly', () => {
    const interval = PollingInterval.create(3600).value;

    expect(interval.toDisplayString()).toBe('1 hour');
  });

  it('should display plural hours', () => {
    const interval = PollingInterval.create(7200).value;

    expect(interval.toDisplayString()).toBe('2 hours');
  });

  // ---------- TO STRING ----------
  it('should return seconds as string with toString()', () => {
    const interval = PollingInterval.create(150).value;
    expect(interval.toString()).toBe('150');
  });
});
