// Source: src/infrastructure/billing/services/PdfKitBillPdfRenderer.ts

import { describe, it, expect } from '@jest/globals';
import { PdfKitBillPdfRenderer } from '../../../../src/infrastructure/billing/services/PdfKitBillPdfRenderer';
import { BillPdfRenderModel } from '../../../../src/application/billing/interfaces';

function makeModel(
  overrides: Partial<BillPdfRenderModel> = {}
): BillPdfRenderModel {
  return {
    billId: '550e8400-e29b-41d4-a716-446655440000',
    period: '2026-07',
    status: 'PENDING',
    issueDate: new Date('2026-07-01T00:00:00Z'),
    dueDate: new Date('2026-07-16T00:00:00Z'),
    paidAt: null,
    total: 59.98,
    lineItems: [
      { planName: 'Fiber 100/20', monthlyPrice: 39.99 },
      { planName: 'TV Basic', monthlyPrice: 19.99 }
    ],
    customer: {
      fullName: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@example.com',
      cedula: '1.234.567'
    },
    ...overrides
  };
}

describe('PdfKitBillPdfRenderer', () => {
  const renderer = new PdfKitBillPdfRenderer();

  it('should produce a non-empty PDF buffer', async () => {
    const result = await renderer.render(makeModel());

    expect(result.isSuccess).toBe(true);
    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should render a paid bill with nullable customer fields', async () => {
    const result = await renderer.render(
      makeModel({
        status: 'PAID',
        paidAt: new Date('2026-07-10T00:00:00Z'),
        customer: {
          fullName: 'Ana Gomez',
          phone: '3009876543',
          email: null,
          cedula: null
        }
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should render a bill with many line items', async () => {
    const lineItems = Array.from({ length: 30 }, (_, i) => ({
      planName: `Plan ${i + 1}`,
      monthlyPrice: 10.5
    }));
    const result = await renderer.render(
      makeModel({ lineItems, total: 315 })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
