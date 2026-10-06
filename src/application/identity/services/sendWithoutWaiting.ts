import {
  EmailMessage,
  IEmailSender,
  ILogger
} from 'application/shared/interfaces';

// For mail the request must not wait on: a slow or failing mail server
// neither holds it up nor changes its answer. The failure is only logged.
export function sendWithoutWaiting(
  emailSender: IEmailSender,
  message: EmailMessage,
  logger: ILogger,
  context: { source: string; userId: string }
): Promise<void> {
  return emailSender
    .send(message)
    .then((sent) => {
      if (sent.isFailure) {
        logger.warn(`${context.source}: email not sent`, {
          userId: context.userId,
          error: sent.error
        });
      }
    })
    .catch((error: unknown) => {
      logger.error(
        `${context.source}: unexpected error`,
        error instanceof Error ? error : new Error(String(error))
      );
    });
}
