/**
 * Represents the shape of the properties allowed for a Value Object.
 *
 * Value Objects hold immutable data and must be compared by their properties,
 * not by identity.
 */
export interface ValueObjectProps {
  // Value Object prop shapes are heterogeneous by design; this is the shared kernel's intentional escape hatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [index: string]: any;
}
