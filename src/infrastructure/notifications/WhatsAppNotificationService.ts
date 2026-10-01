import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';
import {
  ICustomerNotificationService,
  CustomerTemplateMessage
} from 'application/notifications/interfaces';
import { WhatsAppSettingsProps } from 'domain/shared/props';

// The vendor's WhatsApp settings (INS-028), looked up on every send so a
// change from the dashboard needs no restart; null while not configured.
export type WhatsAppSettingsSource =
  () => Promise<WhatsAppSettingsProps | null>;

export const WHATSAPP_NOT_CONFIGURED = 'WhatsApp is not configured';

export class WhatsAppNotificationService
  implements ICustomerNotificationService
{
  private readonly accessToken: string;

  // The access token is a secret and stays in env.
  constructor(
    private readonly settings: WhatsAppSettingsSource,
    accessToken: string | undefined = process.env
      .WHATSAPP_ACCESS_TOKEN
  ) {
    if (!accessToken) {
      throw new Error(
        'WhatsAppNotificationService: WHATSAPP_ACCESS_TOKEN must be set in environment'
      );
    }
    this.accessToken = accessToken;
  }

  async sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>> {
    const settings = await this.settings();
    if (!settings) return Result.fail(WHATSAPP_NOT_CONFIGURED);
    const {
      apiVersion,
      phoneNumberId,
      templateName,
      templateLanguage
    } = settings;
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          // Meta expects bare E.164 digits without the leading '+'
          to: to.value.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [
              {
                type: 'body',
                parameters: message.bodyParams.map((text) => ({
                  type: 'text',
                  text
                }))
              }
            ]
          }
        }),
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const description =
          (body as { error?: { message?: string } }).error?.message ??
          response.statusText;
        return Result.fail(`WhatsApp API error: ${description}`);
      }

      return Result.ok<void>();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return Result.fail(
          'WhatsApp API error: request timed out after 10s'
        );
      }
      return Result.fail(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
