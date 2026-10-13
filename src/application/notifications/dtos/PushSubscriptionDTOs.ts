export interface SubscribePushDTO {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}

export interface PushSubscriptionResponseDTO {
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

export interface UnsubscribePushDTO {
  userId: string;
  endpoint: string;
}

export interface SendTestPushDTO {
  userId: string;
}

export interface SendTestPushResponseDTO {
  delivered: number;
}
