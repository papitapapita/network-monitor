import { Address, AddressProps } from '../../../src/domain';

describe('Address Value Object', () => {
  let validProps: AddressProps;

  beforeEach(() => {
    validProps = {
      street: 'Calle 123',
      houseNumber: '45A',
      city: 'Bogotá',
      province: 'Cundinamarca',
      country: 'Colombia',
      postalCode: '110111',
      complement: 'Apt 302',
      neighborhood: 'Chapinero'
    };
  });

  // -------------------------------------
  // SUCCESSFUL CREATION
  // -------------------------------------

  it('should create a valid minimal address (only required fields)', () => {
    const result = Address.create({
      street: 'Calle Principal',
      city: 'Medellín',
      province: 'Antioquia',
      country: 'Colombia'
    });

    expect(result.isSuccess).toBe(true);
    const address = result.value;

    expect(address.street).toBe('Calle Principal');
    expect(address.city).toBe('Medellín');
    expect(address.province).toBe('Antioquia');
    expect(address.country).toBe('Colombia');
  });

  it('should create a valid full address (all fields)', () => {
    const result = Address.create(validProps);
    expect(result.isSuccess).toBe(true);
    const address = result.value;

    expect(address.houseNumber).toBe('45A');
    expect(address.postalCode).toBe('110111');
    expect(address.complement).toBe('Apt 302');
    expect(address.neighborhood).toBe('Chapinero');
  });

  // -------------------------------------
  // REQUIRED FIELD VALIDATIONS
  // -------------------------------------

  it('should fail if required fields are missing', () => {
    const result = Address.create({
      street: '',
      city: '',
      province: '',
      country: ''
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('street');
  });

  it('should fail if street is too short', () => {
    const result = Address.create({
      ...validProps,
      street: 'St'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('street');
  });

  it('should fail if city is too short', () => {
    const result = Address.create({
      ...validProps,
      city: 'A'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('city');
  });

  it('should fail if province is too short', () => {
    const result = Address.create({
      ...validProps,
      province: 'C'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('province');
  });

  it('should fail if country is too short', () => {
    const result = Address.create({
      ...validProps,
      country: 'C'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('country');
  });

  // -------------------------------------
  // OPTIONAL FIELD VALIDATIONS
  // -------------------------------------

  it('should fail if postalCode is too short', () => {
    const result = Address.create({
      ...validProps,
      postalCode: '12'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('postalCode');
  });

  it('should fail if complement is too long or too short', () => {
    const address = {
      ...validProps,
      complement: ''
    };
    const result = Address.create(address);

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('complement');
  });

  it('should fail if neighborhood is too short', () => {
    const result = Address.create({
      ...validProps,
      neighborhood: 'A'
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('neighborhood');
  });

  // -------------------------------------
  // FORMATTED OUTPUT TESTS
  // -------------------------------------

  it('getFullAddress() should return a fully formatted address', () => {
    const result = Address.create(validProps);
    const address = result.value;

    const full = address.getFullAddress();

    expect(full).toBe(
      'Calle 123 # 45A, Apt 302, Chapinero, Bogotá, Cundinamarca, 110111, Colombia'
    );
  });

  it('getFullAddress() should omit empty optional fields', () => {
    const result = Address.create({
      street: 'Calle Luna',
      city: 'Cali',
      province: 'Valle',
      country: 'Colombia'
    });

    const address = result.value;
    const full = address.getFullAddress();

    expect(full).toBe('Calle Luna, Cali, Valle, Colombia');
  });

  it('getShortAddress() should return short formatted address', () => {
    const result = Address.create(validProps);
    const short = result.value.getShortAddress();

    expect(short).toBe(
      'Calle 123 # 45A, Bogotá, Cundinamarca 110111'
    );
  });

  it('getShortAddress() should work with only required fields', () => {
    const result = Address.create({
      street: 'Av 5',
      city: 'Pasto',
      province: 'Nariño',
      country: 'Colombia'
    });

    const short = result.value.getShortAddress();
    expect(short).toBe('Av 5, Pasto, Nariño');
  });

  // -------------------------------------
  // toString()
  // -------------------------------------

  it('toString() should return the full address', () => {
    const result = Address.create(validProps);
    const str = result.value.toString();

    expect(str).toBe(
      'Calle 123 # 45A, Apt 302, Chapinero, Bogotá, Cundinamarca, 110111, Colombia'
    );
  });
});
