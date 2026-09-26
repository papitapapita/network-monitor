// Source: src/infrastructure/billing/services/PdfKitCollectionAccountPdfRenderer.ts

import { describe, it, expect } from '@jest/globals';
import { PdfKitCollectionAccountPdfRenderer } from '../../../../src/infrastructure/billing/services/PdfKitCollectionAccountPdfRenderer';
import { CollectionAccountPdfRenderModel } from '../../../../src/application/billing/interfaces';

function makeModel(
  overrides: Partial<CollectionAccountPdfRenderModel> = {}
): CollectionAccountPdfRenderModel {
  return {
    number: 'CC-0007',
    status: 'PENDING',
    issueDate: new Date('2026-09-25T15:00:00Z'),
    dueDate: new Date('2026-10-10T15:00:00Z'),
    notes: 'Incluye garantía de 6 meses.',
    customer: {
      name: 'María López',
      document: '1098765432',
      phone: '3001234567',
      email: 'maria@example.com',
      address: 'Cra 27 # 45-12'
    },
    lineItems: [
      {
        description: 'Cámara IP 4MP',
        quantity: 4,
        unitPrice: 185000,
        lineTotal: 740000
      }
    ],
    total: 740000,
    ...overrides
  };
}

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [])
    .length;
}

describe('PdfKitCollectionAccountPdfRenderer', () => {
  const renderer = new PdfKitCollectionAccountPdfRenderer();

  it('[BIL-230] produces a PDF', async () => {
    const result = await renderer.render(makeModel());

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it.each(['PAID', 'CANCELLED'])(
    '[BIL-231] renders a %s account with its stamp',
    async (status) => {
      const result = await renderer.render(makeModel({ status }));

      expect(result.isSuccess).toBe(true);
    }
  );

  it('renders with every optional field empty', async () => {
    const result = await renderer.render(
      makeModel({
        dueDate: null,
        notes: null,
        customer: {
          name: 'Cliente de mostrador',
          document: null,
          phone: null,
          email: null,
          address: null
        }
      })
    );

    expect(result.isSuccess).toBe(true);
  });

  it('continues a long item list onto a second page', async () => {
    const lineItems = Array.from({ length: 40 }, (_, i) => ({
      description: `Punto de red ${i + 1}`,
      quantity: 1,
      unitPrice: 25000,
      lineTotal: 25000
    }));

    const result = await renderer.render(
      makeModel({ lineItems, total: 1000000 })
    );

    expect(result.isSuccess).toBe(true);
    expect(pageCount(result.value)).toBe(2);
  });
});
