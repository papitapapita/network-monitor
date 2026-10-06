import type { ILogger } from 'application/shared/interfaces';
import type {
  IRouterQueueService,
  RouterConnection
} from 'application/service-enforcement/interfaces/IRouterQueueService';
import {
  EnforceRequestMessage,
  EnforceResultMessage
} from 'agent/protocol';

// Answers the backend's enforce requests (AGT-111) with the same RouterOS
// client the backend uses on site. One request at a time: the router's API
// is a single login, and a cut run sends them in a burst. The router login
// in a request lives only as long as the request (AGT-112).
export class EnforceRunner {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly queues: IRouterQueueService,
    private readonly logger: ILogger
  ) {}

  run(request: EnforceRequestMessage): Promise<EnforceResultMessage> {
    const answer = this.queue.then(() => this.apply(request));
    this.queue = answer.catch(() => undefined);
    return answer;
  }

  private async apply(
    request: EnforceRequestMessage
  ): Promise<EnforceResultMessage> {
    const { requestId } = request;
    const connection: RouterConnection = { ...request.router };
    this.logger.debug('Enforce request', {
      action: request.action,
      router: request.router.host
    });
    try {
      switch (request.action) {
        case 'list': {
          const listed =
            await this.queues.listSuspensionQueues(connection);
          return listed.isFailure
            ? failed(requestId, listed.error)
            : {
                type: 'enforce.result',
                requestId,
                queues: listed.value
              };
        }
        case 'add': {
          const added = await this.queues.addSuspensionQueue(
            connection,
            request.queue
          );
          return added.isFailure
            ? failed(requestId, added.error)
            : { type: 'enforce.result', requestId, queues: null };
        }
        case 'remove': {
          const removed = await this.queues.removeSuspensionQueue(
            connection,
            request.name
          );
          return removed.isFailure
            ? failed(requestId, removed.error)
            : { type: 'enforce.result', requestId, queues: null };
        }
        default:
          return failed(requestId, 'Unknown enforce action');
      }
    } catch (error) {
      return failed(
        requestId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

function failed(
  requestId: string,
  error: string
): EnforceResultMessage {
  return {
    type: 'enforce.result',
    requestId,
    error: error.slice(0, 500)
  };
}
