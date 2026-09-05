import PDFDocument from 'pdfkit';
import { Result } from 'domain/shared/core';
import {
  IQuotationPdfRenderer,
  QuotationPdfRenderModel,
  QuotationPdfLineItem
} from 'application/quoting/interfaces';
import { quotationBrandingConfig } from '../config/quotationBrandingConfig';

const MARGIN = 50;
const CONTENT_WIDTH = 495;
const HEADER_BAND_HEIGHT = 90;
const FOOTER_RESERVE = 30;
const GAP = 6;

const IMAGE_COL_WIDTH = 45;
const QTY_COL_WIDTH = 35;
const PRICE_COL_WIDTH = 85;
const TOTAL_COL_WIDTH = 85;
const DESC_COL_WIDTH =
  CONTENT_WIDTH -
  IMAGE_COL_WIDTH -
  QTY_COL_WIDTH -
  PRICE_COL_WIDTH -
  TOTAL_COL_WIDTH -
  GAP * 4;

const COL_X = {
  image: MARGIN,
  description: MARGIN + IMAGE_COL_WIDTH + GAP,
  quantity: MARGIN + IMAGE_COL_WIDTH + GAP + DESC_COL_WIDTH + GAP,
  unitPrice:
    MARGIN +
    IMAGE_COL_WIDTH +
    GAP +
    DESC_COL_WIDTH +
    GAP +
    QTY_COL_WIDTH +
    GAP,
  lineTotal:
    MARGIN +
    IMAGE_COL_WIDTH +
    GAP +
    DESC_COL_WIDTH +
    GAP +
    QTY_COL_WIDTH +
    GAP +
    PRICE_COL_WIDTH +
    GAP
};

export class PdfKitQuotationPdfRenderer
  implements IQuotationPdfRenderer
{
  private pageNumber = 1;

  public async render(
    model: QuotationPdfRenderModel
  ): Promise<Result<Buffer>> {
    try {
      const buffer = await this.buildDocument(model);
      return Result.ok<Buffer>(buffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Buffer>(
        `Failed to render quotation PDF: ${errorMessage}`
      );
    }
  }

  private buildDocument(
    model: QuotationPdfRenderModel
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.pageNumber = 1;
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, model);
      this.drawCustomerBlock(doc, model);
      this.drawLineItemsTable(doc, model);
      this.drawTotals(doc, model);
      this.drawTermsFooter(doc, model);
      this.drawPageFooter(doc);

      doc.end();
    });
  }

  private drawHeader(
    doc: PDFKit.PDFDocument,
    model: QuotationPdfRenderModel
  ): void {
    doc
      .rect(0, 0, doc.page.width, HEADER_BAND_HEIGHT)
      .fill(quotationBrandingConfig.accentColorHex);

    doc
      .fillColor('#ffffff')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(quotationBrandingConfig.companyName, MARGIN, 28, {
        width: CONTENT_WIDTH / 2
      });

    doc
      .fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('COTIZACIÓN', MARGIN, 24, {
        width: CONTENT_WIDTH,
        align: 'right'
      })
      .fontSize(11)
      .font('Helvetica')
      .text(model.quoteNumber, MARGIN, 48, {
        width: CONTENT_WIDTH,
        align: 'right'
      });

    doc.fillColor('#000000').fontSize(10).font('Helvetica');
    doc.text(
      `Issued: ${this.formatDate(model.issueDate)}    Valid until: ${this.formatDate(model.validUntil)}`,
      MARGIN,
      HEADER_BAND_HEIGHT + 15
    );
    doc
      .fillColor(quotationBrandingConfig.accentColorHex)
      .font('Helvetica-Bold')
      .text(
        `This quotation is valid until ${this.formatDate(model.validUntil)}.`,
        MARGIN,
        doc.y + 2
      );
    doc.fillColor('#000000').font('Helvetica').moveDown(1);
  }

  private drawCustomerBlock(
    doc: PDFKit.PDFDocument,
    model: QuotationPdfRenderModel
  ): void {
    const boxY = doc.y;
    const lines = [model.customer.name];
    if (model.customer.phone !== null) {
      lines.push(`Phone: ${model.customer.phone}`);
    }
    if (model.customer.email !== null) {
      lines.push(`Email: ${model.customer.email}`);
    }
    if (model.customer.address !== null) {
      lines.push(`Address: ${model.customer.address}`);
    }

    const boxHeight = 22 + lines.length * 14;
    doc
      .rect(MARGIN, boxY, CONTENT_WIDTH, boxHeight)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#888888')
      .text('PREPARED FOR', MARGIN + 10, boxY + 8);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
    doc.text(lines[0], MARGIN + 10, boxY + 22);
    doc.fontSize(10).font('Helvetica');
    for (const line of lines.slice(1)) {
      doc.text(line, MARGIN + 10, doc.y + 2);
    }

    doc.y = boxY + boxHeight + 20;
  }

  private drawLineItemsTable(
    doc: PDFKit.PDFDocument,
    model: QuotationPdfRenderModel
  ): void {
    this.drawLineItemsHeader(doc);

    doc.fontSize(9).font('Helvetica');
    model.lineItems.forEach((item, index) => {
      const rowHeight = this.estimateRowHeight(doc, item);

      if (
        doc.y + rowHeight >
        doc.page.height - MARGIN - FOOTER_RESERVE
      ) {
        this.drawPageFooter(doc);
        doc.addPage();
        this.pageNumber += 1;
        this.drawLineItemsHeader(doc);
      }

      this.drawLineItemRow(doc, item, index, rowHeight);
    });

    doc.moveDown(0.5);
  }

  private drawLineItemsHeader(doc: PDFKit.PDFDocument): void {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
    const headerY = doc.y;
    doc.text('Image', COL_X.image, headerY, {
      width: IMAGE_COL_WIDTH
    });
    doc.text('Description', COL_X.description, headerY, {
      width: DESC_COL_WIDTH
    });
    doc.text('Qty', COL_X.quantity, headerY, {
      width: QTY_COL_WIDTH,
      align: 'center'
    });
    doc.text('Unit Price', COL_X.unitPrice, headerY, {
      width: PRICE_COL_WIDTH,
      align: 'right'
    });
    doc.text('Line Total', COL_X.lineTotal, headerY, {
      width: TOTAL_COL_WIDTH,
      align: 'right'
    });

    doc.moveDown(0.6);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor('#999999')
      .stroke();
    doc.moveDown(0.4);
  }

  private drawLineItemRow(
    doc: PDFKit.PDFDocument,
    item: QuotationPdfLineItem,
    index: number,
    rowHeight: number
  ): void {
    const rowY = doc.y;

    if (index % 2 === 0) {
      doc
        .rect(MARGIN, rowY, CONTENT_WIDTH, rowHeight)
        .fill('#f7f7f7');
    }

    this.drawThumbnail(doc, item, rowY);

    doc
      .fillColor('#000000')
      .fontSize(9)
      .font('Helvetica')
      .text(item.description, COL_X.description, rowY, {
        width: DESC_COL_WIDTH
      });
    doc.text(String(item.quantity), COL_X.quantity, rowY, {
      width: QTY_COL_WIDTH,
      align: 'center'
    });
    doc.text(
      this.formatMoney(item.unitPrice),
      COL_X.unitPrice,
      rowY,
      {
        width: PRICE_COL_WIDTH,
        align: 'right'
      }
    );
    doc.text(
      this.formatMoney(item.lineTotal),
      COL_X.lineTotal,
      rowY,
      {
        width: TOTAL_COL_WIDTH,
        align: 'right'
      }
    );

    doc.y = rowY + rowHeight;
  }

  private drawThumbnail(
    doc: PDFKit.PDFDocument,
    item: QuotationPdfLineItem,
    rowY: number
  ): void {
    const size = IMAGE_COL_WIDTH - 5;

    if (item.imageBuffer !== null) {
      try {
        doc.image(item.imageBuffer, COL_X.image, rowY, {
          fit: [size, size]
        });
        return;
      } catch {
        // Malformed image data — fall through to the placeholder box so the
        // column stays visually aligned.
      }
    }

    doc
      .rect(COL_X.image, rowY, size, size)
      .fillAndStroke('#eeeeee', '#cccccc');
  }

  private estimateRowHeight(
    doc: PDFKit.PDFDocument,
    item: QuotationPdfLineItem
  ): number {
    const descHeight = doc.heightOfString(item.description, {
      width: DESC_COL_WIDTH
    });
    return Math.max(IMAGE_COL_WIDTH - 5, descHeight) + 12;
  }

  private drawTotals(
    doc: PDFKit.PDFDocument,
    model: QuotationPdfRenderModel
  ): void {
    doc.moveDown(0.5);
    const labelX = COL_X.unitPrice - 80;

    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text('Subtotal', labelX, doc.y, { width: 80 });
    doc.text(
      this.formatMoney(model.subtotal),
      COL_X.lineTotal,
      doc.y - doc.currentLineHeight(),
      { width: TOTAL_COL_WIDTH, align: 'right' }
    );

    doc.text('Tax', labelX, doc.y, { width: 80 });
    doc.text('—', COL_X.lineTotal, doc.y - doc.currentLineHeight(), {
      width: TOTAL_COL_WIDTH,
      align: 'right'
    });

    doc
      .moveTo(labelX, doc.y + 2)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
      .strokeColor('#000000')
      .stroke();
    doc.moveDown(0.5);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(quotationBrandingConfig.accentColorHex);
    doc.text('Total', labelX, doc.y, { width: 80 });
    doc.text(
      this.formatMoney(model.total),
      COL_X.lineTotal,
      doc.y - doc.currentLineHeight(),
      { width: TOTAL_COL_WIDTH, align: 'right' }
    );
    doc.fillColor('#000000').font('Helvetica');
  }

  private drawTermsFooter(
    doc: PDFKit.PDFDocument,
    model: QuotationPdfRenderModel
  ): void {
    doc.moveDown(1.5);
    const bandY = doc.y;
    const lines: string[] = [];
    if (model.notes !== null && model.notes.trim().length > 0) {
      lines.push(model.notes);
    }
    lines.push(
      `This quotation is valid until ${this.formatDate(model.validUntil)}. Prices subject to change after expiry.`
    );
    lines.push(
      `To proceed, contact us at ${quotationBrandingConfig.contactPhone} or ${quotationBrandingConfig.contactEmail}.`
    );

    const bandHeight = 16 + lines.length * 14;
    doc
      .rect(MARGIN, bandY, CONTENT_WIDTH, bandHeight)
      .fill('#f2f2f2');

    doc.fillColor('#333333').fontSize(9).font('Helvetica');
    let y = bandY + 8;
    for (const line of lines) {
      doc.text(line, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
      y = doc.y + 2;
    }

    doc.fillColor('#000000');
  }

  private drawPageFooter(doc: PDFKit.PDFDocument): void {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#888888')
      .text(
        `${quotationBrandingConfig.companyName} — generated ${this.formatDate(new Date())} — page ${this.pageNumber}`,
        MARGIN,
        doc.page.height - MARGIN - 20,
        { width: CONTENT_WIDTH, align: 'center' }
      );
    doc.fillColor('#000000');
  }

  private formatMoney(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    return `${quotationBrandingConfig.currencySymbol}${formatted}`;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
