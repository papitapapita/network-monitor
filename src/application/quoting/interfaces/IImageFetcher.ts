import { Result } from 'domain/shared/core';

export interface IImageFetcher {
  fetch(url: string): Promise<Result<Buffer>>;
}
