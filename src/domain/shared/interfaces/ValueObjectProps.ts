/**
 * Represents the shape of the properties allowed for a Value Object.
 *
 * Value Objects hold immutable data and must be compared by their properties,
 * not by identity.
 */
export interface ValueObjectProps {
  [index: string]: any;
}
