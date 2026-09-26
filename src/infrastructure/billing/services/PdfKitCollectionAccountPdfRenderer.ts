import PDFDocument from 'pdfkit';
import { Result } from 'domain/shared/core';
import {
  ICollectionAccountPdfRenderer,
  CollectionAccountPdfRenderModel,
  CollectionAccountPdfLineItem
} from 'application/billing/interfaces';
import { collectionAccountIssuerConfig as issuer } from '../config/collectionAccountIssuerConfig';
import { spanishAmountInWords } from '../utils/spanishAmountInWords';

const MARGIN = 50;
const CONTENT_WIDTH = 495;
const HEADER_BAND_HEIGHT = 90;
const FOOTER_RESERVE = 30;
const GAP = 6;

const QTY_COL_WIDTH = 45;
const PRICE_COL_WIDTH = 95;
const TOTAL_COL_WIDTH = 95;
const DESC_COL_WIDTH =
  CONTENT_WIDTH -
  QTY_COL_WIDTH -
  PRICE_COL_WIDTH -
  TOTAL_COL_WIDTH -
  GAP * 3;

const COL_X = {
  description: MARGIN,
  quantity: MARGIN + DESC_COL_WIDTH + GAP,
  unitPrice: MARGIN + DESC_COL_WIDTH + GAP + QTY_COL_WIDTH + GAP,
  lineTotal:
    MARGIN +
    DESC_COL_WIDTH +
    GAP +
    QTY_COL_WIDTH +
    GAP +
    PRICE_COL_WIDTH +
    GAP
};

const STATUS_STAMPS: Record<
  string,
  { label: string; color: string }
> = {
  PAID: { label: 'PAGADA', color: '#2E7D32' },
  CANCELLED: { label: 'ANULADA', color: '#C62828' }
};

export class PdfKitCollectionAccountPdfRenderer
  implements ICollectionAccountPdfRenderer
{
  private pageNumber = 1;

  public async render(
    model: CollectionAccountPdfRenderModel
  ): Promise<Result<Buffer>> {
    try {
      const buffer = await this.buildDocument(model);
      return Result.ok<Buffer>(buffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Buffer>(
        `Failed to render collection account PDF: ${errorMessage}`
      );
    }
  }

  private buildDocument(
    model: CollectionAccountPdfRenderModel
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.pageNumber = 1;
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, model);
      this.drawStatusStamp(doc, model);
      this.drawCustomerBlock(doc, model);
      this.drawStatement(doc, model);
      this.drawLineItemsTable(doc, model);
      this.drawTotal(doc, model);
      this.drawNotesAndPayment(doc, model);
      this.drawSignature(doc);
      this.drawPageFooter(doc);

      doc.end();
    });
  }

  private drawHeader(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    doc
      .rect(0, 0, doc.page.width, HEADER_BAND_HEIGHT)
      .fill(issuer.accentColorHex);

    let issuerX = MARGIN;
    if (issuer.logoPath !== null) {
      doc.image(issuer.logoPath, MARGIN, 20, { fit: [50, 50] });
      issuerX = MARGIN + 60;
    }

    doc
      .fillColor('#ffffff')
      .fontSize(15)
      .font('Helvetica-Bold')
      .text(issuer.issuerName, issuerX, 24, {
        width: CONTENT_WIDTH / 2
      })
      .fontSize(9)
      .font('Helvetica')
      .text(
        `${issuer.issuerDocumentLabel} ${issuer.issuerDocument}`,
        issuerX,
        doc.y + 2,
        { width: CONTENT_WIDTH / 2 }
      )
      .text(`${issuer.contactPhone} · ${issuer.contactEmail}`, {
        width: CONTENT_WIDTH / 2
      });

    doc
      .fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('CUENTA DE COBRO', MARGIN, 24, {
        width: CONTENT_WIDTH,
        align: 'right'
      })
      .fontSize(12)
      .font('Helvetica')
      .text(`No. ${model.number}`, MARGIN, 48, {
        width: CONTENT_WIDTH,
        align: 'right'
      });

    doc.fillColor('#000000').fontSize(10).font('Helvetica');
    doc.text(
      `${issuer.issuerCity}, ${this.formatDate(model.issueDate)}`,
      MARGIN,
      HEADER_BAND_HEIGHT + 15
    );
    if (model.dueDate !== null) {
      doc
        .font('Helvetica-Bold')
        .fillColor(issuer.accentColorHex)
        .text(
          `Fecha límite de pago: ${this.formatDate(model.dueDate)}`,
          MARGIN,
          doc.y + 2
        );
    }
    doc.fillColor('#000000').font('Helvetica').moveDown(1);
  }

  private drawStatusStamp(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    const stamp = STATUS_STAMPS[model.status];
    if (stamp === undefined) return;

    const width = 130;
    const x = MARGIN + CONTENT_WIDTH - width;
    const y = HEADER_BAND_HEIGHT + 10;
    doc
      .lineWidth(2)
      .rect(x, y, width, 30)
      .strokeColor(stamp.color)
      .stroke()
      .lineWidth(1);
    doc
      .fillColor(stamp.color)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(stamp.label, x, y + 8, { width, align: 'center' });
    doc.fillColor('#000000').fontSize(10).font('Helvetica');
    doc.y = Math.max(doc.y, y + 40);
  }

  private drawCustomerBlock(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    const boxY = doc.y;
    const lines: string[] = [];
    if (model.customer.document !== null) {
      lines.push(`C.C./NIT: ${model.customer.document}`);
    }
    if (model.customer.phone !== null) {
      lines.push(`Teléfono: ${model.customer.phone}`);
    }
    if (model.customer.email !== null) {
      lines.push(`Correo: ${model.customer.email}`);
    }
    if (model.customer.address !== null) {
      lines.push(`Dirección: ${model.customer.address}`);
    }

    const boxHeight = 38 + lines.length * 14;
    doc
      .rect(MARGIN, boxY, CONTENT_WIDTH, boxHeight)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#888888')
      .text('CLIENTE', MARGIN + 10, boxY + 8);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(model.customer.name, MARGIN + 10, boxY + 22, {
        width: CONTENT_WIDTH - 20
      });
    doc.fontSize(10).font('Helvetica');
    for (const line of lines) {
      doc.text(line, MARGIN + 10, doc.y + 2, {
        width: CONTENT_WIDTH - 20
      });
    }

    doc.y = boxY + boxHeight + 16;
  }

  private drawStatement(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    doc.fontSize(10).fillColor('#000000');
    doc
      .font('Helvetica-Bold')
      .text('DEBE A: ', MARGIN, doc.y, { continued: true })
      .font('Helvetica')
      .text(
        `${issuer.issuerName}, ${issuer.issuerDocumentLabel} ${issuer.issuerDocument}`
      );
    doc
      .font('Helvetica-Bold')
      .text('LA SUMA DE: ', MARGIN, doc.y + 4, {
        width: CONTENT_WIDTH,
        continued: true
      })
      .font('Helvetica')
      .text(
        `${spanishAmountInWords(model.total)} (${this.formatMoney(model.total)})`
      );
    doc
      .font('Helvetica-Bold')
      .text('POR CONCEPTO DE:', MARGIN, doc.y + 4);
    doc.moveDown(0.6);
  }

  private drawLineItemsTable(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    this.drawLineItemsHeader(doc);

    model.lineItems.forEach((item, index) => {
      doc.fontSize(9).font('Helvetica');
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
  }

  private drawLineItemsHeader(doc: PDFKit.PDFDocument): void {
    const headerY = doc.y;
    doc
      .rect(MARGIN, headerY, CONTENT_WIDTH, 20)
      .fill(issuer.accentColorHex);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    const textY = headerY + 6;
    doc.text('Descripción', COL_X.description + 6, textY, {
      width: DESC_COL_WIDTH - 6
    });
    doc.text('Cant.', COL_X.quantity, textY, {
      width: QTY_COL_WIDTH,
      align: 'center'
    });
    doc.text('Valor unitario', COL_X.unitPrice, textY, {
      width: PRICE_COL_WIDTH,
      align: 'right'
    });
    doc.text('Valor total', COL_X.lineTotal, textY, {
      width: TOTAL_COL_WIDTH - 6,
      align: 'right'
    });

    doc.fillColor('#000000');
    doc.y = headerY + 20;
  }

  private drawLineItemRow(
    doc: PDFKit.PDFDocument,
    item: CollectionAccountPdfLineItem,
    index: number,
    rowHeight: number
  ): void {
    const rowY = doc.y;

    if (index % 2 === 1) {
      doc
        .rect(MARGIN, rowY, CONTENT_WIDTH, rowHeight)
        .fill('#f5f7fa');
    }

    const textY = rowY + 6;
    doc
      .fillColor('#000000')
      .fontSize(9)
      .font('Helvetica')
      .text(item.description, COL_X.description + 6, textY, {
        width: DESC_COL_WIDTH - 6
      });
    doc.text(String(item.quantity), COL_X.quantity, textY, {
      width: QTY_COL_WIDTH,
      align: 'center'
    });
    doc.text(
      this.formatMoney(item.unitPrice),
      COL_X.unitPrice,
      textY,
      {
        width: PRICE_COL_WIDTH,
        align: 'right'
      }
    );
    doc.text(
      this.formatMoney(item.lineTotal),
      COL_X.lineTotal,
      textY,
      {
        width: TOTAL_COL_WIDTH - 6,
        align: 'right'
      }
    );

    doc
      .moveTo(MARGIN, rowY + rowHeight)
      .lineTo(MARGIN + CONTENT_WIDTH, rowY + rowHeight)
      .strokeColor('#e0e0e0')
      .stroke();

    doc.y = rowY + rowHeight;
  }

  private estimateRowHeight(
    doc: PDFKit.PDFDocument,
    item: CollectionAccountPdfLineItem
  ): number {
    return (
      doc.heightOfString(item.description, {
        width: DESC_COL_WIDTH - 6
      }) + 12
    );
  }

  private drawTotal(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    this.ensureSpace(doc, 50);
    const boxY = doc.y + 8;
    const boxX = COL_X.unitPrice;
    const boxWidth = MARGIN + CONTENT_WIDTH - boxX;

    doc.rect(boxX, boxY, boxWidth, 26).fill('#eef2f7');
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(issuer.accentColorHex)
      .text('TOTAL', boxX + 8, boxY + 8, { width: 60 })
      .text(this.formatMoney(model.total), boxX, boxY + 8, {
        width: boxWidth - 6,
        align: 'right'
      });

    doc.fillColor('#000000').font('Helvetica').fontSize(10);
    doc.y = boxY + 40;
  }

  private drawNotesAndPayment(
    doc: PDFKit.PDFDocument,
    model: CollectionAccountPdfRenderModel
  ): void {
    const sections: { title: string; lines: string[] }[] = [];
    if (model.notes !== null && model.notes.trim().length > 0) {
      sections.push({ title: 'Observaciones', lines: [model.notes] });
    }
    if (issuer.paymentInstructions.length > 0) {
      sections.push({
        title: 'Forma de pago',
        lines: issuer.paymentInstructions
      });
    }

    for (const section of sections) {
      this.ensureSpace(doc, 50);
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#888888')
        .text(section.title.toUpperCase(), MARGIN, doc.y);
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      for (const line of section.lines) {
        doc.text(line, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
      }
      doc.moveDown(0.8);
    }
  }

  private drawSignature(doc: PDFKit.PDFDocument): void {
    this.ensureSpace(doc, 90);
    const lineY = doc.y + 45;
    doc
      .moveTo(MARGIN, lineY)
      .lineTo(MARGIN + 200, lineY)
      .strokeColor('#000000')
      .stroke();
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(issuer.issuerName, MARGIN, lineY + 4, { width: 250 })
      .font('Helvetica')
      .text(
        `${issuer.issuerDocumentLabel} ${issuer.issuerDocument}`,
        {
          width: 250
        }
      );
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > doc.page.height - MARGIN - FOOTER_RESERVE) {
      this.drawPageFooter(doc);
      doc.addPage();
      this.pageNumber += 1;
    }
  }

  private drawPageFooter(doc: PDFKit.PDFDocument): void {
    const y = doc.y;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#888888')
      .text(
        `${issuer.issuerName} · ${issuer.issuerAddress}, ${issuer.issuerCity} · página ${this.pageNumber}`,
        MARGIN,
        doc.page.height - MARGIN - 20,
        { width: CONTENT_WIDTH, align: 'center', lineBreak: false }
      );
    doc.fillColor('#000000');
    doc.y = y;
  }

  private formatMoney(amount: number): string {
    const formatted = new Intl.NumberFormat(issuer.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
    return `$ ${formatted}`;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString(issuer.locale, {
      timeZone: issuer.timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
