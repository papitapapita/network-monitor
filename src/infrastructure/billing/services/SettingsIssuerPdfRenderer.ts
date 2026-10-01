import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import {
  CollectionAccountPdfRenderModel,
  ICollectionAccountPdfRenderer,
  ISSUER_NOT_CONFIGURED
} from 'application/billing/interfaces';
import {
  IssuerDisplayConfig,
  toIssuerConfig
} from '../config/collectionAccountIssuerConfig';
import { PdfKitCollectionAccountPdfRenderer } from './PdfKitCollectionAccountPdfRenderer';

// Reads the issuer from the vendor's settings for every document, so a change
// from the dashboard shows on the next PDF (BIL-232). A renderer per document
// also keeps its page counter to that document.
export class SettingsIssuerPdfRenderer
  implements ICollectionAccountPdfRenderer
{
  constructor(
    private readonly vendorSettings: IVendorSettingsRepository,
    private readonly display: IssuerDisplayConfig
  ) {}

  async render(
    model: CollectionAccountPdfRenderModel
  ): Promise<Result<Buffer>> {
    const settings = await this.vendorSettings.get();
    if (settings.isFailure) {
      return Result.fail(
        `Failed to read the issuer settings: ${settings.error}`
      );
    }
    const issuer = settings.value.issuer;
    if (issuer === null) return Result.fail(ISSUER_NOT_CONFIGURED);

    return new PdfKitCollectionAccountPdfRenderer(
      toIssuerConfig(issuer, this.display)
    ).render(model);
  }
}
