import { Result } from '../../../src/domain/shared/core/Result';
import {
  IPushSender,
  PushOutcome,
  PushPayload,
  PushTarget
} from '../../../src/application/notifications/interfaces/IPushSender';

/**
 * Stub for IPushSender — never reaches a push service.
 * Endpoints listed in `gone` answer as unsubscribed, those in `failing` fail.
 */
export class FakePushSender implements IPushSender {
  public readonly sent: {
    target: PushTarget;
    payload: PushPayload;
  }[] = [];
  public gone = new Set<string>();
  public failing = new Set<string>();

  async send(
    target: PushTarget,
    payload: PushPayload
  ): Promise<Result<PushOutcome>> {
    this.sent.push({ target, payload });
    if (this.failing.has(target.endpoint)) {
      return Result.fail('Push service error 500: down');
    }
    return Result.ok(
      this.gone.has(target.endpoint) ? 'gone' : 'delivered'
    );
  }
}
