// Source: src/domain/device-inventory/value-objects/Address.ts

import {
  Address,
  AddressProps
} from '../../../../src/domain/device-inventory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validProps(overrides: Partial<AddressProps> = {}): AddressProps {
  return {
    street: '123 Main Street',
    municipality: 'Medellín',
    neighborhood: 'El Poblado',
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('Address', () => {
  // -------------------------------------------------------------------------
  describe('[DEV-095] create()', () => {
    describe('when given valid inputs', () => {
      it('should return a successful Result', () => {
        const result = Address.create(validProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return an Address instance', () => {
        const result = Address.create(validProps());

        expect(result.value).toBeInstanceOf(Address);
      });

      it('should expose the correct street, municipality, and neighborhood', () => {
        const result = Address.create(
          validProps({
            street: 'Calle 10 #43E-31',
            municipality: 'Medellín',
            neighborhood: 'El Centro'
          })
        );

        expect(result.value.street).toBe('Calle 10 #43E-31');
        expect(result.value.municipality).toBe('Medellín');
        expect(result.value.neighborhood).toBe('El Centro');
      });

      it('should accept street at exactly 255 characters', () => {
        const result = Address.create(
          validProps({ street: 'a'.repeat(255) })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('a'.repeat(255));
      });

      it('should accept municipality at exactly 100 characters', () => {
        const result = Address.create(
          validProps({ municipality: 'a'.repeat(100) })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.municipality).toBe('a'.repeat(100));
      });

      it('should accept neighborhood at exactly 150 characters', () => {
        const result = Address.create(
          validProps({ neighborhood: 'a'.repeat(150) })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.neighborhood).toBe('a'.repeat(150));
      });
    });

    // -----------------------------------------------------------------------
    describe('whitespace trimming', () => {
      it('should trim leading and trailing whitespace from street', () => {
        const result = Address.create(
          validProps({ street: '  Main Street  ' })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('Main Street');
      });

      it('should trim leading and trailing whitespace from municipality', () => {
        const result = Address.create(
          validProps({ municipality: '  Bogotá  ' })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.municipality).toBe('Bogotá');
      });

      it('should trim leading and trailing whitespace from neighborhood', () => {
        const result = Address.create(
          validProps({ neighborhood: '  Laureles  ' })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.neighborhood).toBe('Laureles');
      });

      it('should store only the trimmed value — no surrounding spaces', () => {
        const result = Address.create(
          validProps({
            street: '\t Av. Reforma \n',
            municipality: ' CDMX ',
            neighborhood: ' Polanco '
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.street).toBe('Av. Reforma');
        expect(result.value.municipality).toBe('CDMX');
        expect(result.value.neighborhood).toBe('Polanco');
      });
    });

    // -----------------------------------------------------------------------
    describe('street validation', () => {
      it('should fail when street is null', () => {
        const result = Address.create(
          validProps({ street: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('street');
      });

      it('should fail when street is undefined', () => {
        const result = Address.create(
          validProps({ street: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('street');
      });

      it('should fail when street is not a string', () => {
        const result = Address.create(
          validProps({ street: 42 as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('street');
      });

      it('should fail when street is an empty string', () => {
        const result = Address.create(validProps({ street: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when street contains only whitespace', () => {
        const result = Address.create(validProps({ street: '   ' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when street exceeds 255 characters', () => {
        const result = Address.create(
          validProps({ street: 'a'.repeat(256) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('255');
      });
    });

    // -----------------------------------------------------------------------
    describe('municipality validation', () => {
      it('should fail when municipality is null', () => {
        const result = Address.create(
          validProps({ municipality: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('municipality');
      });

      it('should fail when municipality is undefined', () => {
        const result = Address.create(
          validProps({ municipality: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('municipality');
      });

      it('should fail when municipality is not a string', () => {
        const result = Address.create(
          validProps({ municipality: true as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('municipality');
      });

      it('should fail when municipality is an empty string', () => {
        const result = Address.create(validProps({ municipality: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when municipality contains only whitespace', () => {
        const result = Address.create(
          validProps({ municipality: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when municipality exceeds 100 characters', () => {
        const result = Address.create(
          validProps({ municipality: 'a'.repeat(101) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });
    });

    // -----------------------------------------------------------------------
    describe('neighborhood validation', () => {
      it('should fail when neighborhood is null', () => {
        const result = Address.create(
          validProps({ neighborhood: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('neighborhood');
      });

      it('should fail when neighborhood is undefined', () => {
        const result = Address.create(
          validProps({ neighborhood: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('neighborhood');
      });

      it('should fail when neighborhood is not a string', () => {
        const result = Address.create(
          validProps({ neighborhood: [] as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('neighborhood');
      });

      it('should fail when neighborhood is an empty string', () => {
        const result = Address.create(validProps({ neighborhood: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when neighborhood contains only whitespace', () => {
        const result = Address.create(
          validProps({ neighborhood: '\t\n' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail when neighborhood exceeds 150 characters', () => {
        const result = Address.create(
          validProps({ neighborhood: 'a'.repeat(151) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });
    });

    // -----------------------------------------------------------------------
    describe('Guard short-circuit ordering', () => {
      it('should report a street error before checking municipality when both are null', () => {
        const result = Address.create(
          validProps({
            street: null as unknown as string,
            municipality: null as unknown as string
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('street');
      });

      it('should report a municipality error before checking neighborhood when street is valid but municipality is null', () => {
        const result = Address.create(
          validProps({
            municipality: null as unknown as string,
            neighborhood: null as unknown as string
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('municipality');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('reconstitute()', () => {
    it('should create an Address instance without validating', () => {
      const address = Address.reconstitute({
        street: '123 Main Street',
        municipality: 'Medellín',
        neighborhood: 'El Poblado'
      });

      expect(address).toBeInstanceOf(Address);
    });

    it('should expose the exact props it was given without trimming', () => {
      const props: AddressProps = {
        street: '  untrimmed street  ',
        municipality: '  raw municipality  ',
        neighborhood: '  raw neighborhood  '
      };
      const address = Address.reconstitute(props);

      expect(address.street).toBe('  untrimmed street  ');
      expect(address.municipality).toBe('  raw municipality  ');
      expect(address.neighborhood).toBe('  raw neighborhood  ');
    });

    it('should not reject empty strings (bypasses validation)', () => {
      const address = Address.reconstitute({
        street: '',
        municipality: '',
        neighborhood: ''
      });

      expect(address.street).toBe('');
      expect(address.municipality).toBe('');
      expect(address.neighborhood).toBe('');
    });

    it('should not reject strings exceeding length limits (bypasses validation)', () => {
      const longStreet = 'x'.repeat(300);
      const address = Address.reconstitute({
        street: longStreet,
        municipality: 'anywhere',
        neighborhood: 'any'
      });

      expect(address.street).toBe(longStreet);
    });
  });

  // -------------------------------------------------------------------------
  describe('equals() — ValueObject structural equality', () => {
    it('should return true for two instances with identical props', () => {
      const a = Address.create(validProps()).value;
      const b = Address.create(validProps()).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false when street differs', () => {
      const a = Address.create(validProps({ street: 'Street A' })).value;
      const b = Address.create(validProps({ street: 'Street B' })).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when municipality differs', () => {
      const a = Address.create(
        validProps({ municipality: 'Medellín' })
      ).value;
      const b = Address.create(
        validProps({ municipality: 'Bogotá' })
      ).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when neighborhood differs', () => {
      const a = Address.create(
        validProps({ neighborhood: 'El Poblado' })
      ).value;
      const b = Address.create(
        validProps({ neighborhood: 'Laureles' })
      ).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = Address.create(validProps()).value;

      expect(a.equals(null as unknown as Address)).toBe(false);
    });

    it('should return false when compared to undefined', () => {
      const a = Address.create(validProps()).value;

      expect(a.equals(undefined as unknown as Address)).toBe(false);
    });

    it('should return true when comparing a created and a reconstituted instance with the same stored values', () => {
      const props: AddressProps = {
        street: '123 Main Street',
        municipality: 'Medellín',
        neighborhood: 'El Poblado'
      };
      const created = Address.create(props).value;
      const reconstituted = Address.reconstitute(props);

      expect(created.equals(reconstituted)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('getters', () => {
    it('should return the trimmed street value', () => {
      const address = Address.create(
        validProps({ street: '  Carrera 70  ' })
      ).value;

      expect(address.street).toBe('Carrera 70');
    });

    it('should return the trimmed municipality value', () => {
      const address = Address.create(
        validProps({ municipality: '  Cali  ' })
      ).value;

      expect(address.municipality).toBe('Cali');
    });

    it('should return the trimmed neighborhood value', () => {
      const address = Address.create(
        validProps({ neighborhood: '  Granada  ' })
      ).value;

      expect(address.neighborhood).toBe('Granada');
    });
  });

  // -------------------------------------------------------------------------
  describe('[DEV-094] [DEV-095] createOptional()', () => {
    describe('when every field is absent', () => {
      it('should return a successful Result holding null', () => {
        const result = Address.createOptional({
          street: null,
          municipality: null,
          neighborhood: null
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    describe('when the fields are partially supplied', () => {
      const partials = [
        { street: '123 Main Street', municipality: null, neighborhood: null },
        { street: null, municipality: 'Medellín', neighborhood: null },
        { street: null, municipality: null, neighborhood: 'El Poblado' },
        {
          street: '123 Main Street',
          municipality: 'Medellín',
          neighborhood: null
        }
      ];

      for (const partial of partials) {
        const supplied = Object.entries(partial)
          .filter(([, value]) => value !== null)
          .map(([key]) => key)
          .join(', ');

        it(`should fail when only ${supplied} is supplied`, () => {
          const result = Address.createOptional(partial);

          expect(result.isFailure).toBe(true);
          expect(result.error).toBe(
            'An address requires a street, municipality, and neighborhood'
          );
        });
      }
    });

    describe('when every field is supplied', () => {
      it('should return an Address instance', () => {
        const result = Address.createOptional(validProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(Address);
      });

      it('should apply the same field validation as create()', () => {
        const result = Address.createOptional(
          validProps({ street: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Street');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should freeze the internal props object', () => {
      const address = Address.create(validProps()).value;

      expect(() => {
        // @ts-expect-error — testing runtime immutability
        address._props.street = 'mutated';
      }).toThrow();
    });

    it('should freeze the Address instance itself', () => {
      const address = Address.create(validProps()).value;

      expect(Object.isFrozen(address)).toBe(true);
    });
  });
});
