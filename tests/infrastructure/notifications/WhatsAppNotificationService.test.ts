// Source: src/infrastructure/notifications/WhatsAppNotificationService.ts

import { WhatsAppNotificationService } from '../../../src/infrastructure/notifications/WhatsAppNotificationService';
import { PhoneNumber } from '../../../src/domain/customers/value-objects/PhoneNumber';

const ENV_KEYS = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TEMPLATE_NAME',
  'WHATSAPP_TEMPLATE_LANGUAGE',
  'WHATSAPP_API_VERSION'
] as const;

const PHONE = PhoneNumber.reconstitute('+573001234567');

function setEnv(): void {
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
  process.env.WHATSAPP_TEMPLATE_NAME = 'suspension_notice';
  delete process.env.WHATSAPP_TEMPLATE_LANGUAGE;
  delete process.env.WHATSAPP_API_VERSION;
}

describe('WhatsAppNotificationService', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let fetchMock: jest.Mock;

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  beforeEach(() => {
    setEnv();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw when required env vars are missing', () => {
      delete process.env.WHATSAPP_ACCESS_TOKEN;

      expect(() => new WhatsAppNotificationService()).toThrow(
        'WHATSAPP_ACCESS_TOKEN'
      );
    });
  });

  describe('sendTemplate — happy path', () => {
    it('should POST the template payload to the Graph API', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const service = new WhatsAppNotificationService();
      const result = await service.sendTemplate(PHONE, {
        bodyParams: ['Juan Perez']
      });

      expect(result.isSuccess).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://graph.facebook.com/v21.0/123456789/messages'
      );
      expect(init.headers['Authorization']).toBe('Bearer test-token');

      const body = JSON.parse(init.body);
      expect(body).toEqual({
        messaging_product: 'whatsapp',
        to: '573001234567',
        type: 'template',
        template: {
          name: 'suspension_notice',
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: 'Juan Perez' }]
            }
          ]
        }
      });
    });

    it('should strip the leading + from the phone number', async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const service = new WhatsAppNotificationService();
      await service.sendTemplate(PHONE, { bodyParams: [] });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.to).toBe('573001234567');
      expect(body.to).not.toContain('+');
    });

    it('should honour language and API version overrides from env', async () => {
      process.env.WHATSAPP_TEMPLATE_LANGUAGE = 'en_US';
      process.env.WHATSAPP_API_VERSION = 'v22.0';
      fetchMock.mockResolvedValue({ ok: true });

      const service = new WhatsAppNotificationService();
      await service.sendTemplate(PHONE, { bodyParams: [] });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/v22.0/');
      expect(JSON.parse(init.body).template.language.code).toBe(
        'en_US'
      );
    });
  });

  describe('sendTemplate — API errors', () => {
    it('should fail with the API error message on non-2xx response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Template name does not exist' }
        })
      });

      const service = new WhatsAppNotificationService();
      const result = await service.sendTemplate(PHONE, {
        bodyParams: ['Juan']
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Template name does not exist');
    });

    it('should fall back to statusText when the error body is not JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('not json');
        }
      });

      const service = new WhatsAppNotificationService();
      const result = await service.sendTemplate(PHONE, {
        bodyParams: []
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Internal Server Error');
    });

    it('should fail on network error', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const service = new WhatsAppNotificationService();
      const result = await service.sendTemplate(PHONE, {
        bodyParams: []
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should fail with a timeout message when the request times out', async () => {
      const timeoutError = new Error('aborted');
      timeoutError.name = 'TimeoutError';
      fetchMock.mockRejectedValue(timeoutError);

      const service = new WhatsAppNotificationService();
      const result = await service.sendTemplate(PHONE, {
        bodyParams: []
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('timed out');
    });
  });
});
