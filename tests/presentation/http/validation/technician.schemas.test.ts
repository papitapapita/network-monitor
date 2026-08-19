// Source: src/presentation/http/validation/technician.schemas.ts

import { describe, it, expect } from '@jest/globals';
import {
  createTechnicianSchema,
  updateTechnicianSchema,
  getTechnicianByIdSchema,
  deleteTechnicianSchema,
  listTechniciansSchema
} from '../../../../src/presentation/http/validation/technician.schemas';

const UUID = 'c5228bee-15a8-420c-a5ca-39d209f944e5';

describe('technician.schemas', () => {
  describe('createTechnicianSchema', () => {
    it('accepts a minimal valid body', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: { fullName: 'Andrés Muñoz', phone: '+573001112233' }
        }).success
      ).toBe(true);
    });

    it('trims the name', () => {
      const result = createTechnicianSchema.parse({
        body: { fullName: '  Ana Ruiz  ', phone: '+573001112233' }
      });

      expect(result.body.fullName).toBe('Ana Ruiz');
    });

    it('[TKT-090] rejects an empty name', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: { fullName: '   ', phone: '+573001112233' }
        }).success
      ).toBe(false);
    });

    it('[TKT-091] rejects a name over 150 characters', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: { fullName: 'x'.repeat(151), phone: '+573001112233' }
        }).success
      ).toBe(false);
    });

    it('[TKT-092] requires a phone', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: { fullName: 'No Phone' }
        }).success
      ).toBe(false);
    });

    it('accepts common phone formatting', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: {
            fullName: 'Formatted',
            phone: '+57 (300) 111-2233'
          }
        }).success
      ).toBe(true);
    });

    it('rejects a phone with letters', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: { fullName: 'Bad', phone: 'call-me' }
        }).success
      ).toBe(false);
    });

    it('[TKT-093] rejects a malformed email', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: {
            fullName: 'Bad Email',
            phone: '+573001112233',
            email: 'nope'
          }
        }).success
      ).toBe(false);
    });

    it('accepts a null email', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: {
            fullName: 'No Email',
            phone: '+573001112233',
            email: null
          }
        }).success
      ).toBe(true);
    });

    it('rejects a non-UUID user id', () => {
      expect(
        createTechnicianSchema.safeParse({
          body: {
            fullName: 'Bad User',
            phone: '+573001112233',
            userId: 'abc'
          }
        }).success
      ).toBe(false);
    });
  });

  describe('updateTechnicianSchema', () => {
    it('accepts a single field', () => {
      expect(
        updateTechnicianSchema.safeParse({
          params: { id: UUID },
          body: { isActive: false }
        }).success
      ).toBe(true);
    });

    it('rejects an empty body', () => {
      expect(
        updateTechnicianSchema.safeParse({
          params: { id: UUID },
          body: {}
        }).success
      ).toBe(false);
    });

    it('rejects a malformed id', () => {
      expect(
        updateTechnicianSchema.safeParse({
          params: { id: 'nope' },
          body: { isActive: false }
        }).success
      ).toBe(false);
    });
  });

  describe('id-only schemas', () => {
    it.each([
      ['getTechnicianByIdSchema', getTechnicianByIdSchema],
      ['deleteTechnicianSchema', deleteTechnicianSchema]
    ])(
      '%s accepts a UUID and rejects anything else',
      (_name, schema) => {
        expect(
          schema.safeParse({ params: { id: UUID } }).success
        ).toBe(true);
        expect(
          schema.safeParse({ params: { id: 'not-a-uuid' } }).success
        ).toBe(false);
      }
    );
  });

  describe('listTechniciansSchema', () => {
    it('coerces activeOnly from its string form', () => {
      const result = listTechniciansSchema.parse({
        query: { activeOnly: 'true' }
      });

      expect(result.query.activeOnly).toBe(true);
    });

    it('coerces limit and offset to numbers', () => {
      const result = listTechniciansSchema.parse({
        query: { limit: '10', offset: '20' }
      });

      expect(result.query.limit).toBe(10);
      expect(result.query.offset).toBe(20);
    });

    it('rejects a limit above 100', () => {
      expect(
        listTechniciansSchema.safeParse({ query: { limit: '101' } })
          .success
      ).toBe(false);
    });

    it('accepts an empty query', () => {
      expect(
        listTechniciansSchema.safeParse({ query: {} }).success
      ).toBe(true);
    });
  });
});
