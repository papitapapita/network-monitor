import { Result } from 'domain/shared/core';
import { PhoneNumber } from 'domain/customers/value-objects';
import {
  ICustomerNotificationService,
  CustomerTemplateMessage
} from 'application/notifications/interfaces';

export class WhatsAppNotificationService
  implements ICustomerNotificationService
{
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly templateName: string;
  private readonly templateLanguage: string;
  private readonly apiVersion: string;

  constructor() {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;

    if (!accessToken || !phoneNumberId || !templateName) {
      throw new Error(
        'WhatsAppNotificationService: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TEMPLATE_NAME must be set in environment'
      );
    }

    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.templateName = templateName;
    this.templateLanguage =
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'es';
    this.apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
  }

  async sendTemplate(
    to: PhoneNumber,
    message: CustomerTemplateMessage
  ): Promise<Result<void>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

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
            name: this.templateName,
            language: { code: this.templateLanguage },
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
