// Source: src/domain/tickets/value-objects/ServiceAddress.ts

import { describe, it, expect } from '@jest/globals';
import { ServiceAddress } from '../../../../src/domain/tickets';

const validProps = {
  street: 'Calle 5 #12-34',
  municipality: 'Popayán',
  neighborhood: 'Centro'
};

describe('ServiceAddress', () => {
  describe('create()', () => {
    it('should succeed with the three required parts', () => {
      const result = ServiceAddress.create(validProps);

      expect(result.isSuccess).toBe(true);
      expect(result.value.street).toBe('Calle 5 #12-34');
      expect(result.value.reference).toBeNull();
      expect(result.value.hasCoordinates()).toBe(false);
    });

    it('should trim every part', () => {
      const result = ServiceAddress.create({
        street: '  Calle 5  ',
        municipality: '  Popayán  ',
        neighborhood: '  Centro  '
      });

      expect(result.value.street).toBe('Calle 5');
      expect(result.value.municipality).toBe('Popayán');
      expect(result.value.neighborhood).toBe('Centro');
    });

    it('[TKT-007] should reject an empty street', () => {
      const result = ServiceAddress.create({
        ...validProps,
        street: '   '
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Street address cannot be empty'
      );
    });

    it('[TKT-007] should reject an empty municipality', () => {
      const result = ServiceAddress.create({
        ...validProps,
        municipality: ''
      });

      expect(result.isFailure).toBe(true);
    });

    it('[TKT-007] should reject an empty neighborhood', () => {
      const result = ServiceAddress.create({
        ...validProps,
        neighborhood: ''
      });

      expect(result.isFailure).toBe(true);
    });

    it('should reject an overlong street', () => {
      const result = ServiceAddress.create({
        ...validProps,
        street: 'x'.repeat(256)
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot exceed 255 characters');
    });

    it('should treat an empty reference as absent', () => {
      const result = ServiceAddress.create({
        ...validProps,
        reference: '   '
      });

      expect(result.value.reference).toBeNull();
    });

    it('should reject an overlong reference', () => {
      const result = ServiceAddress.create({
        ...validProps,
        reference: 'x'.repeat(256)
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Address reference cannot exceed 255 characters'
      );
    });

    it('[TKT-008] should accept a valid coordinate pair', () => {
      const result = ServiceAddress.create({
        ...validProps,
        latitude: 2.4448,
        longitude: -76.6147
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.hasCoordinates()).toBe(true);
    });

    it('[TKT-008] should reject a latitude with no longitude', () => {
      const result = ServiceAddress.create({
        ...validProps,
        latitude: 2.4448
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'require both a latitude and a longitude'
      );
    });

    it('[TKT-008] should reject an out-of-range latitude', () => {
      const result = ServiceAddress.create({
        ...validProps,
        latitude: 91,
        longitude: 0
      });

      expect(result.isFailure).toBe(true);
    });

    it('[TKT-008] should reject an out-of-range longitude', () => {
      const result = ServiceAddress.create({
        ...validProps,
        latitude: 0,
        longitude: 181
      });

      expect(result.isFailure).toBe(true);
    });

    it('[TKT-008] should reject a non-finite latitude', () => {
      const result = ServiceAddress.create({
        ...validProps,
        latitude: Number.POSITIVE_INFINITY,
        longitude: 0
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('finite');
    });
  });

  describe('createOptional()', () => {
    it('should return null when every part is absent', () => {
      const result = ServiceAddress.createOptional({
        street: null,
        municipality: null,
        neighborhood: null
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('[TKT-007] should reject a partial address', () => {
      const result = ServiceAddress.createOptional({
        street: 'Calle 5',
        municipality: null,
        neighborhood: null
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'requires a street, municipality, and neighborhood'
      );
    });

    it('[TKT-007] should reject coordinates with no street address', () => {
      const result = ServiceAddress.createOptional({
        street: null,
        municipality: null,
        neighborhood: null,
        latitude: 2.4448,
        longitude: -76.6147
      });

      expect(result.isFailure).toBe(true);
    });

    it('should build an address when every part is present', () => {
      const result = ServiceAddress.createOptional({
        street: 'Calle 5',
        municipality: 'Popayán',
        neighborhood: 'Centro'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
    });
  });

  describe('toString()', () => {
    it('should render a single navigable line', () => {
      const address = ServiceAddress.create(validProps).value;

      expect(address.toString()).toBe(
        'Calle 5 #12-34, Centro, Popayán'
      );
    });
  });

  describe('equals()', () => {
    it('should treat identical addresses as equal', () => {
      const a = ServiceAddress.create(validProps).value;
      const b = ServiceAddress.create(validProps).value;

      expect(a.equals(b)).toBe(true);
    });
  });
});
