import { Result } from '../../../src/domain/shared/core';
import { IImageFetcher } from '../../../src/application/quoting/interfaces';

/**
 * Controllable stub for IImageFetcher used in integration tests.
 * A real fetch hits the network for a DeviceModel's imageUrl, so it must
 * never run in a test. Call setShouldFail(true) to simulate a broken/missing
 * image URL — GetQuotationPdfUseCase must still render a PDF in that case.
 */
export class FakeImageFetcher implements IImageFetcher {
  private _shouldFail = false;
  public lastUrl: string | null = null;
  public callCount = 0;

  setShouldFail(fail: boolean): void {
    this._shouldFail = fail;
  }

  reset(): void {
    this._shouldFail = false;
    this.lastUrl = null;
    this.callCount = 0;
  }

  async fetch(url: string): Promise<Result<Buffer>> {
    this.lastUrl = url;
    this.callCount++;
    if (this._shouldFail) {
      return Result.fail<Buffer>('Simulated image fetch failure');
    }
    return Result.ok<Buffer>(Buffer.from('fake-image-bytes'));
  }
}
