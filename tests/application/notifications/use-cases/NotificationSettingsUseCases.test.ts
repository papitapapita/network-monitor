// Source: src/application/notifications/use-cases/GetNotificationSettingsUseCase.ts,
// UpdateNotificationSettingsUseCase.ts, SendTestNotificationUseCase.ts

import { GetNotificationSettingsUseCase } from '../../../../src/application/notifications/use-cases/GetNotificationSettingsUseCase';
import { UpdateNotificationSettingsUseCase } from '../../../../src/application/notifications/use-cases/UpdateNotificationSettingsUseCase';
import {
  SendTestNotificationUseCase,
  NO_TELEGRAM_CHAT
} from '../../../../src/application/notifications/use-cases/SendTestNotificationUseCase';
import { INotificationSettingsRepository } from '../../../../src/domain/notifications/repository/INotificationSettingsRepository';
import { NotificationSettings } from '../../../../src/domain/notifications/value-objects/NotificationSettings';
import { ITestMessageSender } from '../../../../src/application/notifications/interfaces/ITestMessageSender';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeSettings(
  telegramChatId: string | null = '-100123'
): NotificationSettings {
  return NotificationSettings.reconstitute({
    telegramChatId,
    downAlertDelayMinutes: 60,
    wirelessAlertsEnabled: true
  });
}

function makeRepo(
  settings = makeSettings()
): jest.Mocked<INotificationSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(Result.ok(settings)),
    save: jest.fn().mockResolvedValue(Result.ok())
  };
}

describe('GetNotificationSettingsUseCase', () => {
  it('returns the current settings', async () => {
    const useCase = new GetNotificationSettingsUseCase(
      makeRepo(),
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      telegramChatId: '-100123',
      downAlertDelayMinutes: 60,
      wirelessAlertsEnabled: true
    });
  });

  it('fails when the settings cannot be read', async () => {
    const repo = makeRepo();
    repo.get.mockResolvedValue(Result.fail('DB down'));
    const useCase = new GetNotificationSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.error).toBe(
      'Failed to load notification settings: DB down'
    );
  });
});

describe('[NOT-200] UpdateNotificationSettingsUseCase', () => {
  it('saves and returns the new settings', async () => {
    const repo = makeRepo();
    const useCase = new UpdateNotificationSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      telegramChatId: ' -200 ',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: false
    });

    expect(result.value).toEqual({
      telegramChatId: '-200',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: false
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][0].telegramChatId).toBe('-200');
  });

  it('saves nothing when a value is refused', async () => {
    const repo = makeRepo();
    const useCase = new UpdateNotificationSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      telegramChatId: '-200',
      downAlertDelayMinutes: -5,
      wirelessAlertsEnabled: true
    });

    expect(result.error).toContain('downAlertDelayMinutes');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the save fails', async () => {
    const repo = makeRepo();
    repo.save.mockResolvedValue(Result.fail('DB down'));
    const useCase = new UpdateNotificationSettingsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      telegramChatId: null,
      downAlertDelayMinutes: 0,
      wirelessAlertsEnabled: true
    });

    expect(result.error).toBe(
      'Failed to save notification settings: DB down'
    );
  });
});

describe('[NOT-202] SendTestNotificationUseCase', () => {
  let sender: jest.Mocked<ITestMessageSender>;

  beforeEach(() => {
    sender = { send: jest.fn().mockResolvedValue(Result.ok()) };
  });

  it('sends to the saved chat when none is given', async () => {
    const useCase = new SendTestNotificationUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.value).toEqual({ telegramChatId: '-100123' });
    expect(sender.send).toHaveBeenCalledWith(
      '-100123',
      expect.stringContaining('Mensaje de prueba')
    );
  });

  it('sends to the chat typed in the form, without saving it', async () => {
    const repo = makeRepo();
    const useCase = new SendTestNotificationUseCase(
      repo,
      sender,
      makeLogger()
    );

    const result = await useCase.execute({
      telegramChatId: '@isp_alertas'
    });

    expect(result.value).toEqual({ telegramChatId: '@isp_alertas' });
    expect(sender.send.mock.calls[0][0]).toBe('@isp_alertas');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('escapes the message for Telegram Markdown', async () => {
    const useCase = new SendTestNotificationUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    await useCase.execute({});

    expect(sender.send.mock.calls[0][1]).toContain('chat\\.');
  });

  it('refuses a chat id that could not be saved', async () => {
    const useCase = new SendTestNotificationUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    const result = await useCase.execute({
      telegramChatId: 'my-group'
    });

    expect(result.error).toContain('telegramChatId must be');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('fails when no chat is saved or given', async () => {
    const useCase = new SendTestNotificationUseCase(
      makeRepo(makeSettings(null)),
      sender,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.error).toBe(NO_TELEGRAM_CHAT);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('reports what Telegram answered when delivery fails', async () => {
    sender.send.mockResolvedValue(
      Result.fail('Telegram API error: Bad Request: chat not found')
    );
    const useCase = new SendTestNotificationUseCase(
      makeRepo(),
      sender,
      makeLogger()
    );

    const result = await useCase.execute({});

    expect(result.error).toBe(
      'Test message not delivered: Telegram API error: Bad Request: chat not found'
    );
  });
});
