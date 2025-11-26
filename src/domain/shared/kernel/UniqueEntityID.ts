import { Identifier } from './Identifier';

/**
 * Represents a unique identifier for entities.
 *
 * Extends the base {@link Identifier} class and automatically generates
 * a UUID (version 4–style random UUID) if no value is provided.
 */
export class UniqueEntityID extends Identifier<string | number> {
  /**
   * Creates a new UniqueEntityID instance.
   *
   * If an ID is not provided, a UUID will be generated automatically.
   *
   * @param {string | number} [id] - Optional raw identifier value. If omitted, a UUID is generated.
   */
  constructor(id?: string | number) {
    super(id ? id : UniqueEntityID.generateUUID());
  }

  /**
   * Generates a pseudo-random UUID using a simple template-based method.
   *
   * **Note:** This is not cryptographically secure and serves as a lightweight
   * UUID generator suitable for non-cryptographic use cases.
   *
   * @private
   * @returns {string} A generated UUID string.
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
