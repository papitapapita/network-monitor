import { IPAddress } from '../../../src/domain/value-objects/';

describe('IPAddress ValueObject', () => {
  // --- VALID IPv4 ---
  it('should create a valid IPv4 address', () => {
    const result = IPAddress.create('192.168.1.1');

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe('192.168.1.1');
    expect(result.value.isIPv4()).toBe(true);
    expect(result.value.isIPv6()).toBe(false);
  });

  // --- INVALID IPv4 ---
  it('should fail with invalid IPv4 format (out of range numbers)', () => {
    const result = IPAddress.create('999.168.1.1');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid IP address format');
  });

  it('should fail if IPv4 missing octets', () => {
    const result = IPAddress.create('192.168.1');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid IP address format');
  });

  it('should fail if IPv4 contains invalid characters', () => {
    const result = IPAddress.create('192.168.a.1');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid IP address format');
  });

  // --- VALID IPv6 ---
  it('should create a valid IPv6 address', () => {
    const result = IPAddress.create(
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.isIPv6()).toBe(true);
    expect(result.value.isIPv4()).toBe(false);
  });

  it('should accept compressed IPv6 format (::)', () => {
    const result = IPAddress.create('2001:db8::8a2e:370:7334');

    expect(result.isSuccess).toBe(true);
    expect(result.value.isIPv6()).toBe(true);
  });

  // --- INVALID IPv6 ---
  it('should fail with invalid IPv6', () => {
    const result = IPAddress.create('2001:::85a3:::7334');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid IP address format');
  });

  // --- Null / Undefined / Empty ---
  it('should fail when IP is null', () => {
    // @ts-ignore - force null as input
    const result = IPAddress.create(null);

    expect(result.isSuccess).toBe(false);
  });

  it('should fail when IP is undefined', () => {
    // @ts-ignore - force undefined
    const result = IPAddress.create(undefined);

    expect(result.isSuccess).toBe(false);
  });

  it('should fail when IP is empty string', () => {
    const result = IPAddress.create('');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  // --- Trimming ---
  it('should trim spaces before validation', () => {
    const result = IPAddress.create(' 192.168.1.1 ');

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe('192.168.1.1');
  });

  // --- toString() ---
  it('should return the IP as string using toString()', () => {
    const result = IPAddress.create('192.168.1.1');

    expect(result.value.toString()).toBe('192.168.1.1');
  });
});
