import { MACAddress } from '../../../src/domain/value-objects';

describe('MACAddress ValueObject', () => {
  const validColonMAC = 'AA:BB:CC:DD:EE:FF';
  const validHyphenMAC = 'AA-BB-CC-DD-EE-FF';
  const lowercaseMAC = 'aa:bb:cc:dd:ee:ff';

  // --- VALID ADDRESSES ---

  it('should create a valid MAC address in colon format', () => {
    const result = MACAddress.create(validColonMAC);

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe(validColonMAC);
  });

  it('should create a valid MAC address in hyphen format and normalize', () => {
    const result = MACAddress.create(validHyphenMAC);

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('should normalize lowercase MAC to uppercase', () => {
    const result = MACAddress.create(lowercaseMAC);

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe(validColonMAC);
  });

  // --- INVALID ADDRESSES ---

  it('should fail if MAC has invalid format', () => {
    const result = MACAddress.create('AA:BB:CC:DD:EE'); // Too short

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid MAC address format');
  });

  it('should fail if contains invalid characters', () => {
    const result = MACAddress.create('GG:BB:CC:DD:EE:FF');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid MAC address format');
  });

  it('should fail if separator style is inconsistent', () => {
    const result = MACAddress.create('AA:BB-CC:DD-EE:FF');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid MAC address format');
  });

  // --- NULL / UNDEFINED / EMPTY ---

  it('should fail when MAC is null', () => {
    // @ts-ignore forced null
    const result = MACAddress.create(null);

    expect(result.isSuccess).toBe(false);
  });

  it('should fail when MAC is undefined', () => {
    // @ts-ignore forced undefined
    const result = MACAddress.create(undefined);

    expect(result.isSuccess).toBe(false);
  });

  it('should fail when MAC is empty string', () => {
    const result = MACAddress.create('');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  // --- TRIMMING ---

  it('should trim spaces before validation', () => {
    const result = MACAddress.create('   AA-BB-CC-DD-EE-FF  ');

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe('AA:BB:CC:DD:EE:FF');
  });

  // --- METHOD TESTS ---

  it('normalize() should return colon-separated uppercase format', () => {
    const mac = MACAddress.create(validHyphenMAC).value;

    expect(mac.normalize()).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('toString() should return the same normalized value', () => {
    const mac = MACAddress.create(validColonMAC).value;

    expect(mac.toString()).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('toHyphenFormat() should convert to hyphen-separated format', () => {
    const mac = MACAddress.create(validColonMAC).value;

    expect(mac.toHyphenFormat()).toBe('AA-BB-CC-DD-EE-FF');
  });

  it('toCompactFormat() should return MAC without separators', () => {
    const mac = MACAddress.create(validColonMAC).value;

    expect(mac.toCompactFormat()).toBe('AABBCCDDEEFF');
  });
});
