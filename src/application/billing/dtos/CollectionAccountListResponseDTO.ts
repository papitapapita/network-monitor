import { CollectionAccountResponseDTO } from './CollectionAccountResponseDTO';

export interface CollectionAccountListResponseDTO {
  collectionAccounts: CollectionAccountResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
