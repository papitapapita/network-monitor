// Source: src/infrastructure/quoting/services/PdfKitQuotationPdfRenderer.ts

import { describe, it, expect } from '@jest/globals';
import { PdfKitQuotationPdfRenderer } from '../../../../src/infrastructure/quoting/services/PdfKitQuotationPdfRenderer';
import { QuotationPdfRenderModel } from '../../../../src/application/quoting/interfaces';

// A minimal valid 1x1 PNG, so pdfkit can actually decode a real thumbnail.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function makeModel(
  overrides: Partial<QuotationPdfRenderModel> = {}
): QuotationPdfRenderModel {
  return {
    quoteNumber: 'COT-0001',
    status: 'SENT',
    issueDate: new Date('2026-07-01T00:00:00Z'),
    validUntil: new Date('2026-08-01T00:00:00Z'),
    notes: 'Includes installation labor.',
    customer: {
      name: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@example.com',
      address: 'Calle 5 #12-34'
    },
    lineItems: [
      {
        imageBuffer: null,
        description: 'LiteBeam 5AC antenna',
        vendorName: 'Ubiquiti',
        quantity: 2,
        unitPrice: 89.99,
        lineTotal: 179.98
      }
    ],
    subtotal: 179.98,
    total: 179.98,
    ...overrides
  };
}

describe('PdfKitQuotationPdfRenderer', () => {
  const renderer = new PdfKitQuotationPdfRenderer();

  it('should produce a non-empty PDF buffer', async () => {
    const result = await renderer.render(makeModel());

    expect(result.isSuccess).toBe(true);
    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should render a line item thumbnail when an image buffer is present', async () => {
    const result = await renderer.render(
      makeModel({
        lineItems: [
          {
            imageBuffer: TINY_PNG,
            description: 'LiteBeam 5AC antenna',
            vendorName: 'Ubiquiti',
            quantity: 1,
            unitPrice: 89.99,
            lineTotal: 89.99
          }
        ]
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should fall back to a placeholder without throwing when the image buffer is malformed', async () => {
    const result = await renderer.render(
      makeModel({
        lineItems: [
          {
            imageBuffer: Buffer.from('not-a-real-image'),
            description: 'LiteBeam 5AC antenna',
            vendorName: 'Ubiquiti',
            quantity: 1,
            unitPrice: 89.99,
            lineTotal: 89.99
          }
        ]
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should render a quotation with no customer contact details', async () => {
    const result = await renderer.render(
      makeModel({
        customer: {
          name: 'Prospect Corp',
          phone: null,
          email: null,
          address: null
        }
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should paginate across multiple pages for many line items', async () => {
    const lineItems = Array.from({ length: 40 }, (_, i) => ({
      imageBuffer: null,
      description: `Item ${i + 1}`,
      vendorName: 'Ubiquiti',
      quantity: 1,
      unitPrice: 10.5,
      lineTotal: 10.5
    }));
    const result = await renderer.render(
      makeModel({ lineItems, subtotal: 420, total: 420 })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
