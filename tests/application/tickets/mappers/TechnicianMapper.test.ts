// Source: src/application/tickets/mappers/TechnicianMapper.ts

import { describe, it, expect } from '@jest/globals';
import { TechnicianMapper } from '../../../../src/application/tickets/mappers';
import {
  Technician,
  ContactPhone
} from '../../../../src/domain/tickets';
import { UserId } from '../../../../src/domain/shared/ids';

function makeTechnician(
  overrides: Record<string, unknown> = {}
): Technician {
  const result = Technician.create({
    fullName: 'Andrés Muñoz',
    phone: ContactPhone.reconstitute('+573001112233'),
    email: null,
    userId: null,
    ...overrides
  } as Parameters<typeof Technician.create>[0]);
  if (result.isFailure) throw new Error(result.error);
  return result.value;
}

describe('TechnicianMapper (application)', () => {
  describe('toDTO()', () => {
    it('renders the phone value object as a string', () => {
      const dto = TechnicianMapper.toDTO(makeTechnician());

      expect(dto.phone).toBe('+573001112233');
    });

    it('renders timestamps as ISO strings', () => {
      const dto = TechnicianMapper.toDTO(makeTechnician());

      expect(dto.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it('renders an absent user link as null', () => {
      expect(
        TechnicianMapper.toDTO(makeTechnician()).userId
      ).toBeNull();
    });

    it('renders a present user link as a string', () => {
      const userId = UserId.create();

      const dto = TechnicianMapper.toDTO(makeTechnician({ userId }));

      expect(dto.userId).toBe(userId.toString());
    });
  });

  describe('toSummaryDTO()', () => {
    it('carries only what a ticket needs to show', () => {
      const summary = TechnicianMapper.toSummaryDTO(makeTechnician());

      expect(Object.keys(summary).sort()).toEqual([
        'email',
        'fullName',
        'id',
        'isActive',
        'phone'
      ]);
    });
  });

  describe('toListDTO()', () => {
    it('reports hasMore when the page does not reach the total', () => {
      const dto = TechnicianMapper.toListDTO(
        [makeTechnician()],
        5,
        1,
        0
      );

      expect(dto.total).toBe(5);
      expect(dto.hasMore).toBe(true);
    });

    it('handles an empty page', () => {
      const dto = TechnicianMapper.toListDTO([], 0, 20, 0);

      expect(dto.technicians).toEqual([]);
      expect(dto.hasMore).toBe(false);
    });
  });
});
