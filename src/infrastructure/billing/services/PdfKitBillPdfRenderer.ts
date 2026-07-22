import PDFDocument from 'pdfkit';
import { Result } from 'domain/shared/core';
import {
  IBillPdfRenderer,
  BillPdfRenderModel
} from 'application/billing/interfaces';

const MARGIN = 50;
const CONTENT_WIDTH = 512;
const PRICE_COL_WIDTH = 100;

export class PdfKitBillPdfRenderer implements IBillPdfRenderer {
  public async render(
    model: BillPdfRenderModel
  ): Promise<Result<Buffer>> {
    try {
      const buffer = await this.buildDocument(model);
      return Result.ok<Buffer>(buffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Buffer>(
        `Failed to render bill PDF: ${errorMessage}`
      );
    }
  }

  private buildDocument(model: BillPdfRenderModel): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, model);
      this.drawCustomer(doc, model);
      this.drawLineItems(doc, model);
      this.drawTotal(doc, model);
      this.drawFooter(doc, model);

      doc.end();
    });
  }

  private drawHeader(
    doc: PDFKit.PDFDocument,
    model: BillPdfRenderModel
  ): void {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(`Bill — ${model.period}`, { align: 'left' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555555')
      .text(`Bill ID: ${model.billId}`)
      .text(`Status: ${model.status}`)
      .text(`Issued: ${this.formatDate(model.issueDate)}`)
      .text(`Due: ${this.formatDate(model.dueDate)}`);
    if (model.paidAt !== null) {
      doc.text(`Paid: ${this.formatDate(model.paidAt)}`);
    }
    doc.fillColor('#000000').moveDown(1.5);
  }

  private drawCustomer(
    doc: PDFKit.PDFDocument,
    model: BillPdfRenderModel
  ): void {
    doc.fontSize(12).font('Helvetica-Bold').text('Billed to');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(model.customer.fullName)
      .text(`Phone: ${model.customer.phone}`);
    if (model.customer.email !== null) {
      doc.text(`Email: ${model.customer.email}`);
    }
    if (model.customer.cedula !== null) {
      doc.text(`ID: ${model.customer.cedula}`);
    }
    doc.moveDown(1.5);
  }

  private drawLineItems(
    doc: PDFKit.PDFDocument,
    model: BillPdfRenderModel
  ): void {
    const priceColX = MARGIN + CONTENT_WIDTH - PRICE_COL_WIDTH;

    doc.fontSize(12).font('Helvetica-Bold');
    const headerY = doc.y;
    doc.text('Service plan', MARGIN, headerY);
    doc.text('Monthly price', priceColX, headerY, {
      width: PRICE_COL_WIDTH,
      align: 'right'
    });
    doc
      .moveTo(MARGIN, doc.y + 4)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 4)
      .strokeColor('#999999')
      .stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    for (const item of model.lineItems) {
      const rowY = doc.y;
      doc.text(item.planName, MARGIN, rowY, {
        width: CONTENT_WIDTH - PRICE_COL_WIDTH - 10
      });
      doc.text(this.formatMoney(item.monthlyPrice), priceColX, rowY, {
        width: PRICE_COL_WIDTH,
        align: 'right'
      });
      doc.moveDown(0.3);
    }
    doc.moveDown(0.5);
  }

  private drawTotal(
    doc: PDFKit.PDFDocument,
    model: BillPdfRenderModel
  ): void {
    const priceColX = MARGIN + CONTENT_WIDTH - PRICE_COL_WIDTH;

    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor('#000000')
      .stroke();
    doc.moveDown(0.5);

    const totalY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total', MARGIN, totalY);
    doc.text(this.formatMoney(model.total), priceColX, totalY, {
      width: PRICE_COL_WIDTH,
      align: 'right'
    });
  }

  private drawFooter(
    doc: PDFKit.PDFDocument,
    model: BillPdfRenderModel
  ): void {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#888888')
      .text(
        `Generated ${this.formatDate(new Date())} — billing period ${model.period}`,
        MARGIN,
        doc.page.height - MARGIN - 20
      );
  }

  private formatMoney(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
