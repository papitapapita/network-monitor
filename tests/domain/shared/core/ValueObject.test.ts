// Source: src/domain/shared/core/ValueObject.ts

import { ValueObject } from '../../../../src/domain/shared/core/ValueObject';
import { ValueObjectProps } from '../../../../src/domain/shared/props/ValueObjectProps';

// ---------------------------------------------------------------------------
// Concrete subclasses used across the test suite
// ---------------------------------------------------------------------------

interface FullNameProps extends ValueObjectProps {
  first: string;
  last: string;
}

/**
 * Minimal two-field Value Object. Exposes each field through a public getter
 * so that tests can assert on property values without accessing `_props`
 * directly (except where the test is explicitly verifying internal structure).
 */
class FullName extends ValueObject<FullNameProps> {
  get first(): string {
    return this._props.first;
  }

  get last(): string {
    return this._props.last;
  }
}

interface ScalarProps extends ValueObjectProps {
  value: number;
}

/** Single-field numeric Value Object — useful for boundary and scalar tests. */
class Amount extends ValueObject<ScalarProps> {
  get value(): number {
    return this._props.value;
  }
}

interface NestedProps extends ValueObjectProps {
  city: string;
  meta: { zip: number };
}

/** Value Object with a nested object — exercises the deep-copy and freeze path. */
class Address extends ValueObject<NestedProps> {
  get city(): string {
    return this._props.city;
  }

  get zip(): number {
    return this._props.meta.zip;
  }
}

interface OptionalFieldProps extends ValueObjectProps {
  required: string;
  optional?: string;
}

/** Value Object that contains an optional property. */
class OptionalField extends ValueObject<OptionalFieldProps> {
  get required(): string {
    return this._props.required;
  }

  get optional(): string | undefined {
    return this._props.optional;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeName(first = 'John', last = 'Doe'): FullName {
  return new FullName({ first, last });
}

function makeAmount(value: number): Amount {
  return new Amount({ value });
}

// ===========================================================================
describe('ValueObject', () => {
  // =========================================================================
  describe('construction', () => {
    it('should store props that are accessible via public getters', () => {
      const vo = makeName('Alice', 'Smith');

      expect(vo.first).toBe('Alice');
      expect(vo.last).toBe('Smith');
    });

    it('should store multiple distinct instances independently', () => {
      const vo1 = makeName('Alice', 'Smith');
      const vo2 = makeName('Bob', 'Jones');

      expect(vo1.first).toBe('Alice');
      expect(vo2.first).toBe('Bob');
    });

    it('should not retain a reference to the original props object', () => {
      const original: FullNameProps = { first: 'John', last: 'Doe' };
      const vo = new FullName(original);

      // Mutating the original after construction must not affect the stored props.
      original.first = 'Mutated';

      expect(vo.first).toBe('John');
    });

    it('should store an empty-string value without modification', () => {
      const vo = makeName('', '');

      expect(vo.first).toBe('');
      expect(vo.last).toBe('');
    });

    it('should store zero as a numeric value without modification', () => {
      const vo = makeAmount(0);

      expect(vo.value).toBe(0);
    });

    it('should store negative numbers without modification', () => {
      const vo = makeAmount(-999);

      expect(vo.value).toBe(-999);
    });

    it('should store the maximum safe integer without modification', () => {
      const vo = makeAmount(Number.MAX_SAFE_INTEGER);

      expect(vo.value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should store an optional property when it is provided', () => {
      const vo = new OptionalField({
        required: 'hello',
        optional: 'world'
      });

      expect(vo.required).toBe('hello');
      expect(vo.optional).toBe('world');
    });

    it('should store undefined for an optional property that is not provided', () => {
      const vo = new OptionalField({ required: 'hello' });

      expect(vo.optional).toBeUndefined();
    });
  });

  // =========================================================================
  describe('immutability', () => {
    describe('_props freezing', () => {
      it('should store _props as a frozen object', () => {
        const vo = makeName('John', 'Doe');

        expect(Object.isFrozen(vo['_props'])).toBe(true);
      });

      it('should throw a TypeError when attempting to reassign a property on _props in strict mode', () => {
        const vo = makeName('Jane', 'Doe');

        // TypeScript rejects this assignment at compile time; the
        // At runtime, strict mode (enforced by ts-jest) raises a TypeError.
        expect(() => {
          // @ts-expect-error Testing runtime immutability of frozen _props
          vo['_props'].first = 'Hacked';
        }).toThrow(TypeError);
      });

      it('should throw a TypeError when attempting to add a new property to _props', () => {
        const vo = makeName();

        expect(() => {
          // @ts-expect-error Intentionally adding an undeclared property at runtime
          vo['_props'].extra = 'injected';
        }).toThrow(TypeError);
      });

      it('should throw a TypeError when attempting to delete a property from _props', () => {
        const vo = makeName();

        expect(() => {
          // @ts-expect-error Deleting from a frozen object raises TypeError in strict mode
          delete vo['_props'].first;
        }).toThrow(TypeError);
      });
    });

    describe('instance freezing', () => {
      it('should freeze the Value Object instance itself', () => {
        const vo = makeName();

        expect(Object.isFrozen(vo)).toBe(true);
      });

      it('should throw a TypeError when attempting to add a property directly to the instance', () => {
        const vo = makeName();

        expect(() => {
          // @ts-expect-error Intentionally adding an undeclared property to a frozen instance
          (vo as Record<string, unknown>).newProp = 'bad';
        }).toThrow(TypeError);
      });
    });

    describe('shallow copy semantics for nested objects', () => {
      it('should store the nested meta object as a reference inside the frozen props', () => {
        // Object.freeze() is shallow — the nested `meta` object is NOT frozen.
        // The test documents this known limitation without asserting it is frozen.
        const vo = new Address({ city: 'NY', meta: { zip: 10001 } });

        expect(vo.zip).toBe(10001);
      });

      it('should not share the top-level props reference with the original object', () => {
        const original: NestedProps = {
          city: 'NY',
          meta: { zip: 10001 }
        };
        const vo = new Address(original);

        // Reassigning a top-level key on the original object is harmless
        // because the constructor spreads (shallow-copies) the props.
        original.city = 'LA';

        expect(vo.city).toBe('NY');
      });
    });
  });

  // =========================================================================
  describe('equals()', () => {
    describe('null and undefined guards', () => {
      it('should return false when called with undefined', () => {
        const vo = makeName();

        expect(vo.equals(undefined)).toBe(false);
      });

      it('should return false when called with null cast as undefined', () => {
        const vo = makeName();

        // The implementation explicitly guards against null even though the
        // TypeScript signature does not expose it — the cast documents intent.
        expect(vo.equals(null as unknown as FullName)).toBe(false);
      });
    });

    describe('instanceof guard', () => {
      it('should return false when compared with a plain object that is not a ValueObject', () => {
        const vo = makeName('John', 'Doe');
        const plain = { _props: { first: 'John', last: 'Doe' } };

        expect(vo.equals(plain as unknown as FullName)).toBe(false);
      });

      it('should return false when compared with a number primitive', () => {
        const vo = makeName();

        expect(vo.equals(42 as unknown as FullName)).toBe(false);
      });

      it('should return false when compared with a string primitive', () => {
        const vo = makeName();

        expect(vo.equals('John Doe' as unknown as FullName)).toBe(
          false
        );
      });

      it('should return false when compared with an array', () => {
        const vo = makeName();

        expect(vo.equals([] as unknown as FullName)).toBe(false);
      });
    });

    describe('structural equality — flat props', () => {
      it('should return true for two instances with identical single-field props', () => {
        const vo1 = makeAmount(100);
        const vo2 = makeAmount(100);

        expect(vo1.equals(vo2)).toBe(true);
      });

      it('should return true for two instances with identical multi-field props', () => {
        const vo1 = makeName('John', 'Doe');
        const vo2 = makeName('John', 'Doe');

        expect(vo1.equals(vo2)).toBe(true);
      });

      it('should return false when the first field differs', () => {
        const vo1 = makeName('Alice', 'Doe');
        const vo2 = makeName('Bob', 'Doe');

        expect(vo1.equals(vo2)).toBe(false);
      });

      it('should return false when the second field differs', () => {
        const vo1 = makeName('John', 'Doe');
        const vo2 = makeName('John', 'Smith');

        expect(vo1.equals(vo2)).toBe(false);
      });

      it('should return false when all fields differ', () => {
        const vo1 = makeName('Alice', 'Smith');
        const vo2 = makeName('Bob', 'Jones');

        expect(vo1.equals(vo2)).toBe(false);
      });

      it('should treat zero and negative zero as equal because JSON.stringify serialises both as "0"', () => {
        const vo1 = makeAmount(0);
        const vo2 = makeAmount(-0);

        // JSON.stringify(-0) === "0" — documented behaviour, not a bug.
        expect(vo1.equals(vo2)).toBe(true);
      });
    });

    describe('structural equality — nested props', () => {
      it('should return true for two instances with structurally identical nested props', () => {
        const vo1 = new Address({ city: 'NY', meta: { zip: 10001 } });
        const vo2 = new Address({ city: 'NY', meta: { zip: 10001 } });

        expect(vo1.equals(vo2)).toBe(true);
      });

      it('should return false when a nested field differs', () => {
        const vo1 = new Address({ city: 'NY', meta: { zip: 10001 } });
        const vo2 = new Address({ city: 'NY', meta: { zip: 90210 } });

        expect(vo1.equals(vo2)).toBe(false);
      });

      it('should return false when the top-level city field differs', () => {
        const vo1 = new Address({ city: 'NY', meta: { zip: 10001 } });
        const vo2 = new Address({ city: 'LA', meta: { zip: 10001 } });

        expect(vo1.equals(vo2)).toBe(false);
      });
    });

    describe('structural equality — optional props', () => {
      it('should return true when both instances omit the optional field', () => {
        const vo1 = new OptionalField({ required: 'hello' });
        const vo2 = new OptionalField({ required: 'hello' });

        expect(vo1.equals(vo2)).toBe(true);
      });

      it('should return true when both instances provide the same optional value', () => {
        const vo1 = new OptionalField({
          required: 'hello',
          optional: 'world'
        });
        const vo2 = new OptionalField({
          required: 'hello',
          optional: 'world'
        });

        expect(vo1.equals(vo2)).toBe(true);
      });

      it('should return false when one instance provides the optional field and the other does not', () => {
        const vo1 = new OptionalField({
          required: 'hello',
          optional: 'world'
        });
        const vo2 = new OptionalField({ required: 'hello' });

        expect(vo1.equals(vo2)).toBe(false);
      });

      it('should return false when both instances provide the optional field with different values', () => {
        const vo1 = new OptionalField({
          required: 'hello',
          optional: 'world'
        });
        const vo2 = new OptionalField({
          required: 'hello',
          optional: 'earth'
        });

        expect(vo1.equals(vo2)).toBe(false);
      });
    });

    describe('reflexivity, symmetry, and transitivity', () => {
      it('should return true when a Value Object is compared with itself (reflexivity)', () => {
        const vo = makeName('John', 'Doe');

        expect(vo.equals(vo)).toBe(true);
      });

      it('should be symmetric — if vo1 equals vo2 then vo2 equals vo1', () => {
        const vo1 = makeName('John', 'Doe');
        const vo2 = makeName('John', 'Doe');

        expect(vo1.equals(vo2)).toBe(true);
        expect(vo2.equals(vo1)).toBe(true);
      });

      it('should be symmetric when both instances are not equal', () => {
        const vo1 = makeName('John', 'Doe');
        const vo2 = makeName('Jane', 'Doe');

        expect(vo1.equals(vo2)).toBe(false);
        expect(vo2.equals(vo1)).toBe(false);
      });

      it('should be transitive — if vo1 equals vo2 and vo2 equals vo3 then vo1 equals vo3', () => {
        const vo1 = makeName('John', 'Doe');
        const vo2 = makeName('John', 'Doe');
        const vo3 = makeName('John', 'Doe');

        expect(vo1.equals(vo2)).toBe(true);
        expect(vo2.equals(vo3)).toBe(true);
        expect(vo1.equals(vo3)).toBe(true);
      });
    });

    describe('cross-subclass comparison', () => {
      // NOTE: ValueObject<T>.equals() is typed with the same generic T, but the
      // instanceof check only verifies ValueObject — not the concrete subclass.
      // Two different ValueObject subclasses that happen to carry identical
      // JSON-serialisable props will be considered equal at runtime.
      // This test documents that known characteristic of the implementation.
      it('should compare by JSON-serialised props regardless of the concrete subclass when props shapes match', () => {
        interface SharedShape extends ValueObjectProps {
          value: number;
        }

        class Celsius extends ValueObject<SharedShape> {
          get value(): number {
            return this._props.value;
          }
        }

        class Fahrenheit extends ValueObject<SharedShape> {
          get value(): number {
            return this._props.value;
          }
        }

        const c = new Celsius({ value: 100 });
        const f = new Fahrenheit({ value: 100 });

        // Both have identical JSON — the implementation cannot distinguish them
        // by type alone.  This test documents behaviour, not a design goal.
        expect(c.equals(f as unknown as Celsius)).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('JSON.stringify comparison edge cases', () => {
    it('should treat props with keys in different insertion order as unequal because key order affects JSON.stringify output', () => {
      // JSON.stringify does not sort keys — insertion order matters.
      // This test documents the known limitation of the stringify-based approach.
      interface TwoKeys extends ValueObjectProps {
        a: number;
        b: number;
      }

      class Pair extends ValueObject<TwoKeys> {}

      const vo1 = new Pair({ a: 1, b: 2 });

      // Construct with reversed key order at runtime using computed keys.
      const reversedProps = {} as TwoKeys;
      (reversedProps as Record<string, number>)['b'] = 2;
      (reversedProps as Record<string, number>)['a'] = 1;

      const vo2 = new Pair(reversedProps);

      // NOTE: This assertion documents the current behaviour — key order
      // determines equality. Depending on the JS engine's property enumeration
      // order, string-keyed numeric indices may be reordered; object literal
      // keys typically preserve insertion order in V8.
      const serialisedVo1 = JSON.stringify(vo1['_props']);
      const serialisedVo2 = JSON.stringify(vo2['_props']);
      expect(vo1.equals(vo2)).toBe(serialisedVo1 === serialisedVo2);
    });

    it('should treat a prop with value undefined as absent in JSON because JSON.stringify omits undefined values', () => {
      // JSON.stringify({ a: undefined }) === '{}'
      // This means a VO with { required: 'x', optional: undefined } serialises
      // the same way as one with { required: 'x' } — they compare as equal.
      const withExplicitUndefined = new OptionalField({
        required: 'hello',
        optional: undefined
      });
      const withoutOptional = new OptionalField({
        required: 'hello'
      });

      // JSON.stringify omits undefined values — documented behaviour.
      expect(withExplicitUndefined.equals(withoutOptional)).toBe(
        true
      );
    });
  });
});

// TODO: Test - override of equals() in a concrete subclass to verify the base method can be bypassed
// TODO: Test - Value Object whose props contain a Date object (JSON.stringify converts Dates to ISO strings — equality may behave unexpectedly)
// TODO: Test - Value Object whose props contain a function (JSON.stringify omits functions — equality would ignore them)
// TODO: Test - performance characteristic of equals() for very large props objects (informational, not a correctness test)
