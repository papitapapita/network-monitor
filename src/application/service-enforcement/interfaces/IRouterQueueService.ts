import { Result } from 'domain/shared/core';

export const SUSPENSION_QUEUE_PREFIX = 'suspend-';

export function suspensionQueueName(
  contractedServiceId: string
): string {
  return `${SUSPENSION_QUEUE_PREFIX}${contractedServiceId}`;
}

export interface RouterConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface SuspensionQueue {
  name: string;
  targetIp: string;
}

export interface IRouterQueueService {
  listSuspensionQueues(
    connection: RouterConnection
  ): Promise<Result<SuspensionQueue[]>>;
  addSuspensionQueue(
    connection: RouterConnection,
    queue: SuspensionQueue
  ): Promise<Result<void>>;
  removeSuspensionQueue(
    connection: RouterConnection,
    name: string
  ): Promise<Result<void>>;
}
