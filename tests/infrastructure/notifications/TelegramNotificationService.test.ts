// Source: src/infrastructure/notifications/TelegramNotificationService.ts

import {
  TelegramNotificationService,
  NO_TELEGRAM_CHAT_CONFIGURED
} from '../../../src/infrastructure/notifications/TelegramNotificationService';
import { NotificationMessage } from '../../../src/application/notifications/interfaces';

const ENV_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const;

const MESSAGE: NotificationMessage = {
  title: 'Agente sin conexión',
  body: 'hola',
  metadata: {
    deviceId: null,
    deviceName: null,
    ipAddress: null,
    severity: 'critical',
    timestamp: '2026-09-30T20:00:00.000Z'
  }
};

describe('TelegramNotificationService', () => {
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
    process.env.TELEGRAM_BOT_TOKEN = 'install-bot';
    process.env.TELEGRAM_CHAT_ID = '-100';
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const sentTo = (): { url: string; chatId: string } => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url, chatId: JSON.parse(init.body).chat_id };
  };

  it('should send to the install chat through the install bot by default', async () => {
    await new TelegramNotificationService().send(MESSAGE);

    expect(sentTo()).toEqual({
      url: 'https://api.telegram.org/botinstall-bot/sendMessage',
      chatId: '-100'
    });
  });

  it('should send to another chat through the install bot when only the chat is given', async () => {
    await new TelegramNotificationService('42').send(MESSAGE);

    expect(sentTo()).toEqual({
      url: 'https://api.telegram.org/botinstall-bot/sendMessage',
      chatId: '42'
    });
  });

  it('should send through the given bot when one is given', async () => {
    await new TelegramNotificationService('42', 'vendor-bot').send(
      MESSAGE
    );

    expect(sentTo()).toEqual({
      url: 'https://api.telegram.org/botvendor-bot/sendMessage',
      chatId: '42'
    });
  });

  it('[NOT-200] should look the chat up on every send', async () => {
    const chats = ['-1', '-2'];
    const service = new TelegramNotificationService(
      async () => chats.shift()!
    );

    await service.send(MESSAGE);
    await service.send(MESSAGE);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).chat_id).toBe(
      '-1'
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).chat_id).toBe(
      '-2'
    );
  });

  it('[NOT-200] should fail without calling Telegram when no chat is configured', async () => {
    const service = new TelegramNotificationService(async () => null);

    const result = await service.send(MESSAGE);

    expect(result.error).toBe(NO_TELEGRAM_CHAT_CONFIGURED);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('[NOT-202] should send a given text to a given chat', async () => {
    await new TelegramNotificationService().sendTo(
      '@isp_alertas',
      'hola'
    );

    expect(sentTo()).toEqual({
      url: 'https://api.telegram.org/botinstall-bot/sendMessage',
      chatId: '@isp_alertas'
    });
  });

  it('should throw when no bot token is available', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    expect(() => new TelegramNotificationService()).toThrow(
      'a bot token and a chat id must be set'
    );
  });

  it('should throw when no chat id is available', () => {
    delete process.env.TELEGRAM_CHAT_ID;

    expect(() => new TelegramNotificationService()).toThrow(
      'a bot token and a chat id must be set'
    );
  });

  it('should fail with the API description when Telegram refuses the message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({
        description: 'Bad Request: chat not found'
      })
    });

    const result = await new TelegramNotificationService().send(
      MESSAGE
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Telegram API error: Bad Request: chat not found'
    );
  });
});
