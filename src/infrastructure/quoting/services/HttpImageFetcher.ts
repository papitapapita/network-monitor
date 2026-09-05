import { Result } from 'domain/shared/core';
import { IImageFetcher } from 'application/quoting/interfaces';

const FETCH_TIMEOUT_MS = 5000;

export class HttpImageFetcher implements IImageFetcher {
  public async fetch(url: string): Promise<Result<Buffer>> {
    try {
      const response = await globalThis.fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        return Result.fail<Buffer>(
          `Image fetch returned HTTP ${response.status}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Result.ok<Buffer>(Buffer.from(arrayBuffer));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Buffer>(
        `Failed to fetch image: ${errorMessage}`
      );
    }
  }
}
