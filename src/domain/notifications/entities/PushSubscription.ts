import { Entity, Guard, Result } from 'domain/shared/core';
import { PushSubscriptionId } from 'domain/shared/ids';
import { PushSubscriptionProps } from '../props';

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 255;
const MAX_USER_AGENT_LENGTH = 255;
const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

export interface PushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

// One phone or browser that agreed to receive the install's alerts
// (NOT-220). The endpoint is the push service's address for that browser,
// so it identifies the subscription on its own.
export class PushSubscription extends Entity<
  PushSubscriptionProps,
  PushSubscriptionId
> {
  private constructor(
    props: PushSubscriptionProps,
    id: PushSubscriptionId
  ) {
    super(props, id);
  }

  get userId(): string {
    return this.props.userId;
  }

  get endpoint(): string {
    return this.props.endpoint;
  }

  get p256dh(): string {
    return this.props.p256dh;
  }

  get auth(): string {
    return this.props.auth;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public static create(
    input: PushSubscriptionInput,
    id: PushSubscriptionId = PushSubscriptionId.create()
  ): Result<PushSubscription> {
    const guard = Guard.againstNullOrUndefinedBulk([
      { argument: input?.userId, argumentName: 'userId' },
      { argument: input?.endpoint, argumentName: 'endpoint' },
      { argument: input?.p256dh, argumentName: 'p256dh' },
      { argument: input?.auth, argumentName: 'auth' }
    ]);
    if (!guard.succeeded) {
      return Result.fail<PushSubscription>(guard.message!);
    }

    const userId = input.userId.trim();
    const endpoint = input.endpoint.trim();
    const p256dh = input.p256dh.trim();
    const auth = input.auth.trim();

    const error =
      (userId ? null : 'userId is required') ??
      PushSubscription.validateEndpoint(endpoint) ??
      PushSubscription.validateKey('p256dh', p256dh) ??
      PushSubscription.validateKey('auth', auth);
    if (error) return Result.fail<PushSubscription>(error);

    const userAgent =
      input.userAgent?.trim().slice(0, MAX_USER_AGENT_LENGTH) || null;

    return Result.ok(
      new PushSubscription(
        {
          userId,
          endpoint,
          p256dh,
          auth,
          userAgent,
          createdAt: new Date()
        },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: PushSubscriptionId,
    props: PushSubscriptionProps
  ): PushSubscription {
    return new PushSubscription(props, id);
  }

  // Push services are only ever reached over HTTPS; anything else is a
  // forged subscription aiming the server's requests somewhere it chose.
  private static validateEndpoint(endpoint: string): string | null {
    if (!endpoint) return 'endpoint is required';
    if (endpoint.length > MAX_ENDPOINT_LENGTH) {
      return `endpoint must be at most ${MAX_ENDPOINT_LENGTH} characters`;
    }
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return 'endpoint must be an https URL';
    }
    return url.protocol === 'https:'
      ? null
      : 'endpoint must be an https URL';
  }

  private static validateKey(
    name: string,
    value: string
  ): string | null {
    if (!value) return `${name} is required`;
    if (value.length > MAX_KEY_LENGTH || !BASE64URL.test(value)) {
      return `${name} must be a base64url key of at most ${MAX_KEY_LENGTH} characters`;
    }
    return null;
  }
}
