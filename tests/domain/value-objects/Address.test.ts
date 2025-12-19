import { Address, AddressProps } from '../../../src/domain';

describe('Address', () => {
  describe('create', () => {
    describe('when valid minimal address (required fields only)', () => {
      it('should create Address with required fields', () => {
        const result = Address.create({
          street: 'Calle Principal',
          city: 'Medellín',
          province: 'Antioquia',
          country: 'Colombia'
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('Calle Principal');
        expect(result.value.city).toBe('Medellín');
        expect(result.value.province).toBe('Antioquia');
        expect(result.value.country).toBe('Colombia');
        expect(result.value.houseNumber).toBeUndefined();
        expect(result.value.postalCode).toBeUndefined();
        expect(result.value.complement).toBeUndefined();
        expect(result.value.neighborhood).toBeUndefined();
      });
    });

    describe('when valid full address (all fields)', () => {
      it('should create Address with all fields', () => {
        const result = Address.create({
          street: 'Calle 123',
          houseNumber: '45A',
          city: 'Bogotá',
          province: 'Cundinamarca',
          country: 'Colombia',
          postalCode: '110111',
          complement: 'Apt 302',
          neighborhood: 'Chapinero'
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('Calle 123');
        expect(result.value.houseNumber).toBe('45A');
        expect(result.value.city).toBe('Bogotá');
        expect(result.value.province).toBe('Cundinamarca');
        expect(result.value.country).toBe('Colombia');
        expect(result.value.postalCode).toBe('110111');
        expect(result.value.complement).toBe('Apt 302');
        expect(result.value.neighborhood).toBe('Chapinero');
      });

      it('should trim all fields', () => {
        const result = Address.create({
          street: '  Calle 123  ',
          houseNumber: '  45A  ',
          city: '  Bogotá  ',
          province: '  Cundinamarca  ',
          country: '  Colombia  ',
          postalCode: '  110111  ',
          complement: '  Apt 302  ',
          neighborhood: '  Chapinero  '
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('Calle 123');
        expect(result.value.houseNumber).toBe('45A');
        expect(result.value.city).toBe('Bogotá');
        expect(result.value.province).toBe('Cundinamarca');
        expect(result.value.country).toBe('Colombia');
        expect(result.value.postalCode).toBe('110111');
        expect(result.value.complement).toBe('Apt 302');
        expect(result.value.neighborhood).toBe('Chapinero');
      });
    });

    describe('when required field validations', () => {
      describe('street validation', () => {
        it('should fail for null street', () => {
          const result = Address.create({
            street: null as any,
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('street');
        });

        it('should fail for undefined street', () => {
          const result = Address.create({
            street: undefined as any,
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('street');
        });

        it('should fail for empty street', () => {
          const result = Address.create({
            street: '',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('street');
        });

        it('should fail for street too short (< 3 chars)', () => {
          const result = Address.create({
            street: 'St',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('street');
        });

        it('should succeed for street with exactly 3 characters', () => {
          const result = Address.create({
            street: 'Str',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for street too long (> 200 chars)', () => {
          const longStreet = 'A'.repeat(201);
          const result = Address.create({
            street: longStreet,
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('street');
        });

        it('should succeed for street with exactly 200 characters', () => {
          const maxStreet = 'A'.repeat(200);
          const result = Address.create({
            street: maxStreet,
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('city validation', () => {
        it('should fail for null city', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: null as any,
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('city');
        });

        it('should fail for undefined city', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: undefined as any,
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('city');
        });

        it('should fail for city too short (< 2 chars)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'A',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('city');
        });

        it('should succeed for city with exactly 2 characters', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'AB',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for city too long (> 100 chars)', () => {
          const longCity = 'A'.repeat(101);
          const result = Address.create({
            street: 'Calle Principal',
            city: longCity,
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('city');
        });

        it('should succeed for city with exactly 100 characters', () => {
          const maxCity = 'A'.repeat(100);
          const result = Address.create({
            street: 'Calle Principal',
            city: maxCity,
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('province validation', () => {
        it('should fail for null province', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: null as any,
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('province');
        });

        it('should fail for undefined province', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: undefined as any,
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('province');
        });

        it('should fail for province too short (< 2 chars)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'C',
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('province');
        });

        it('should succeed for province with exactly 2 characters', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'AB',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for province too long (> 100 chars)', () => {
          const longProvince = 'A'.repeat(101);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: longProvince,
            country: 'Colombia'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('province');
        });

        it('should succeed for province with exactly 100 characters', () => {
          const maxProvince = 'A'.repeat(100);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: maxProvince,
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('country validation', () => {
        it('should fail for null country', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: null as any
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('country');
        });

        it('should fail for undefined country', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: undefined as any
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('country');
        });

        it('should fail for country too short (< 2 chars)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'C'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('country');
        });

        it('should succeed for country with exactly 2 characters', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'AB'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for country too long (> 100 chars)', () => {
          const longCountry = 'A'.repeat(101);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: longCountry
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('country');
        });

        it('should succeed for country with exactly 100 characters', () => {
          const maxCountry = 'A'.repeat(100);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: maxCountry
          });

          expect(result.isSuccess).toBe(true);
        });
      });
    });

    describe('when optional field validations', () => {
      describe('houseNumber validation', () => {
        it('should succeed without houseNumber', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
          expect(result.value.houseNumber).toBeUndefined();
        });

        it('should ignore for houseNumber too short (< 1 char when provided)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            houseNumber: ''
          });

          expect(result.value.houseNumber).toBe(undefined);
        });

        it('should succeed for houseNumber with exactly 1 character', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            houseNumber: 'A'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for houseNumber too long (> 20 chars)', () => {
          const longHouseNumber = 'A'.repeat(21);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            houseNumber: longHouseNumber
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('houseNumber');
        });

        it('should succeed for houseNumber with exactly 20 characters', () => {
          const maxHouseNumber = 'A'.repeat(20);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            houseNumber: maxHouseNumber
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('postalCode validation', () => {
        it('should succeed without postalCode', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
          expect(result.value.postalCode).toBeUndefined();
        });

        it('should fail for postalCode too short (< 3 chars when provided)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            postalCode: '12'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('postalCode');
        });

        it('should succeed for postalCode with exactly 3 characters', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            postalCode: '123'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for postalCode too long (> 20 chars)', () => {
          const longPostalCode = 'A'.repeat(21);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            postalCode: longPostalCode
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('postalCode');
        });

        it('should succeed for postalCode with exactly 20 characters', () => {
          const maxPostalCode = 'A'.repeat(20);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            postalCode: maxPostalCode
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('complement validation', () => {
        it('should succeed without complement', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
          expect(result.value.complement).toBeUndefined();
        });

        it('should ignore for complement too short (< 1 char when provided)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            complement: ''
          });

          expect(result.value.complement).toBeUndefined();
        });

        it('should succeed for complement with exactly 1 character', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            complement: 'A'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for complement too long (> 200 chars)', () => {
          const longComplement = 'A'.repeat(201);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            complement: longComplement
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('complement');
        });

        it('should succeed for complement with exactly 200 characters', () => {
          const maxComplement = 'A'.repeat(200);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            complement: maxComplement
          });

          expect(result.isSuccess).toBe(true);
        });
      });

      describe('neighborhood validation', () => {
        it('should succeed without neighborhood', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia'
          });

          expect(result.isSuccess).toBe(true);
          expect(result.value.neighborhood).toBeUndefined();
        });

        it('should fail for neighborhood too short (< 2 chars when provided)', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            neighborhood: 'A'
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('neighborhood');
        });

        it('should succeed for neighborhood with exactly 2 characters', () => {
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            neighborhood: 'AB'
          });

          expect(result.isSuccess).toBe(true);
        });

        it('should fail for neighborhood too long (> 100 chars)', () => {
          const longNeighborhood = 'A'.repeat(101);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            neighborhood: longNeighborhood
          });

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain('neighborhood');
        });

        it('should succeed for neighborhood with exactly 100 characters', () => {
          const maxNeighborhood = 'A'.repeat(100);
          const result = Address.create({
            street: 'Calle Principal',
            city: 'Medellín',
            province: 'Antioquia',
            country: 'Colombia',
            neighborhood: maxNeighborhood
          });

          expect(result.isSuccess).toBe(true);
        });
      });
    });
  });

  describe('getFullAddress', () => {
    it('should return full address with all fields', () => {
      const result = Address.create({
        street: 'Calle 123',
        houseNumber: '45A',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia',
        postalCode: '110111',
        complement: 'Apt 302',
        neighborhood: 'Chapinero'
      });

      expect(result.value.getFullAddress()).toBe(
        'Calle 123 # 45A, Apt 302, Chapinero, Bogotá, Cundinamarca, 110111, Colombia'
      );
    });

    it('should omit empty optional fields', () => {
      const result = Address.create({
        street: 'Calle Luna',
        city: 'Cali',
        province: 'Valle',
        country: 'Colombia'
      });

      expect(result.value.getFullAddress()).toBe(
        'Calle Luna, Cali, Valle, Colombia'
      );
    });

    it('should include house number in street when provided', () => {
      const result = Address.create({
        street: 'Main Street',
        houseNumber: '123',
        city: 'New York',
        province: 'NY',
        country: 'USA'
      });

      expect(result.value.getFullAddress()).toBe(
        'Main Street # 123, New York, NY, USA'
      );
    });

    it('should include partial optional fields correctly', () => {
      const result = Address.create({
        street: 'Avenida Central',
        city: 'San José',
        province: 'San José',
        country: 'Costa Rica',
        postalCode: '10101'
      });

      expect(result.value.getFullAddress()).toBe(
        'Avenida Central, San José, San José, 10101, Costa Rica'
      );
    });
  });

  describe('getShortAddress', () => {
    it('should return short address with all fields', () => {
      const result = Address.create({
        street: 'Calle 123',
        houseNumber: '45A',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia',
        postalCode: '110111',
        complement: 'Apt 302',
        neighborhood: 'Chapinero'
      });

      expect(result.value.getShortAddress()).toBe(
        'Calle 123 # 45A, Bogotá, Cundinamarca 110111'
      );
    });

    it('should work with only required fields', () => {
      const result = Address.create({
        street: 'Av 5',
        city: 'Pasto',
        province: 'Nariño',
        country: 'Colombia'
      });

      expect(result.value.getShortAddress()).toBe(
        'Av 5, Pasto, Nariño'
      );
    });

    it('should include house number when provided', () => {
      const result = Address.create({
        street: 'Main Street',
        houseNumber: '456',
        city: 'Boston',
        province: 'MA',
        country: 'USA',
        postalCode: '02101'
      });

      expect(result.value.getShortAddress()).toBe(
        'Main Street # 456, Boston, MA 02101'
      );
    });

    it('should not include complement or neighborhood', () => {
      const result = Address.create({
        street: 'Street 1',
        city: 'City 1',
        province: 'Province 1',
        country: 'Country 1',
        complement: 'Floor 5',
        neighborhood: 'Downtown'
      });

      const shortAddress = result.value.getShortAddress();
      expect(shortAddress).not.toContain('Floor 5');
      expect(shortAddress).not.toContain('Downtown');
    });
  });

  describe('equals', () => {
    it('should return true for addresses with same values', () => {
      const props: AddressProps = {
        street: 'Calle 123',
        houseNumber: '45A',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia',
        postalCode: '110111',
        complement: 'Apt 302',
        neighborhood: 'Chapinero'
      };

      const address1 = Address.create(props).value;
      const address2 = Address.create(props).value;

      expect(address1.equals(address2)).toBe(true);
    });

    it('should return false for addresses with different values', () => {
      const address1 = Address.create({
        street: 'Calle 123',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia'
      }).value;

      const address2 = Address.create({
        street: 'Calle 456',
        city: 'Medellín',
        province: 'Antioquia',
        country: 'Colombia'
      }).value;

      expect(address1.equals(address2)).toBe(false);
    });

    it('should return false for null', () => {
      const address = Address.create({
        street: 'Calle 123',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia'
      }).value;

      expect(address.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const address = Address.create({
        street: 'Calle 123',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia'
      }).value;

      expect(address.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the full address', () => {
      const result = Address.create({
        street: 'Calle 123',
        houseNumber: '45A',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia',
        postalCode: '110111',
        complement: 'Apt 302',
        neighborhood: 'Chapinero'
      });

      expect(result.value.toString()).toBe(
        'Calle 123 # 45A, Apt 302, Chapinero, Bogotá, Cundinamarca, 110111, Colombia'
      );
    });

    it('should equal getFullAddress', () => {
      const result = Address.create({
        street: 'Test Street',
        city: 'Test City',
        province: 'Test Province',
        country: 'Test Country'
      });

      expect(result.value.toString()).toBe(
        result.value.getFullAddress()
      );
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const address = Address.create({
        street: 'Calle 123',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia'
      }).value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        address.props.street = 'Calle 456';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const address = Address.create({
        street: 'Calle 123',
        city: 'Bogotá',
        province: 'Cundinamarca',
        country: 'Colombia'
      }).value;

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      address.props = {
        street: 'New Street',
        city: 'New City',
        province: 'New Province',
        country: 'New Country'
      };
    });
  });
});
