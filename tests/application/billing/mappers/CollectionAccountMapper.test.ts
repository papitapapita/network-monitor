// Source: src/application/billing/mappers/CollectionAccountMapper.ts

import { describe, it, expect } from '@jest/globals';
import { CollectionAccountMapper } from '../../../../src/application/billing/mappers';
import { CollectionAccountStatus } from '../../../../src/domain/billing';
import {
  ACCOUNT_UUID,
  NOW,
  makeCollectionAccount
} from '../use-cases/collectionAccountFixtures';

describe('CollectionAccountMapper', () => {
  describe('toDTO', () => {
    it('maps every field, serialising dates as ISO strings', () => {
      const dto = CollectionAccountMapper.toDTO(
        makeCollectionAccount(CollectionAccountStatus.PAID)
      );

      expect(dto).toEqual({
        id: ACCOUNT_UUID,
        code: 7,
        number: 'CC-0007',
        status: 'PAID',
        customerId: null,
        customerName: 'María López',
        customerDocument: '1098765432',
        customerPhone: '3001234567',
        customerEmail: null,
        customerAddress: 'Cra 27 # 45-12',
        lineItems: [
          {
            description: 'Cámara IP 4MP',
            unitPrice: 185000,
            quantity: 4,
            lineTotal: 740000
          }
        ],
        total: 740000,
        paymentAccounts: [
          {
            bankName: 'Bancolombia',
            accountType: 'SAVINGS',
            accountNumber: '39500002227',
            label: 'Bancolombia · Ahorros · 39500002227'
          }
        ],
        issueDate: NOW.toISOString(),
        dueDate: null,
        notes: null,
        paidAt: NOW.toISOString(),
        cancelledAt: null,
        createdBy: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString()
      });
    });
  });

  describe('formatNumber', () => {
    it('[BIL-206] zero-pads the code to four digits behind CC-', () => {
      expect(CollectionAccountMapper.formatNumber(7)).toBe('CC-0007');
      expect(CollectionAccountMapper.formatNumber(12345)).toBe(
        'CC-12345'
      );
    });

    it('[BIL-206] has no number before the first save', () => {
      expect(CollectionAccountMapper.formatNumber(null)).toBeNull();
    });
  });

  describe('toListDTO', () => {
    it('reports hasMore when rows remain past this page', () => {
      const list = CollectionAccountMapper.toListDTO(
        [makeCollectionAccount()],
        5,
        1,
        0
      );

      expect(list.hasMore).toBe(true);
      expect(list.total).toBe(5);
    });
  });
});
