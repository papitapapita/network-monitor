import { Result } from 'domain/shared/core';
import { PushSubscription } from '../entities';

export interface IPushSubscriptionRepository {
  // Keyed by endpoint: a browser subscribing again — or another user signing
  // in on the same phone — takes over the existing row (NOT-221).
  save(
    subscription: PushSubscription
  ): Promise<Result<PushSubscription>>;
  // Only subscriptions whose user can still sign in (NOT-223).
  listActive(): Promise<Result<PushSubscription[]>>;
  listByUser(userId: string): Promise<Result<PushSubscription[]>>;
  // Returns whether a row was removed; scoped to the user when one is given.
  deleteByEndpoint(
    endpoint: string,
    userId?: string
  ): Promise<Result<boolean>>;
}
