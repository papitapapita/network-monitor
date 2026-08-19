import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Provide dummy Telegram credentials so the DI container can be instantiated
// in route integration tests. The actual Telegram service is never called in
// those tests (alerts listing doesn't send notifications).
process.env.TELEGRAM_BOT_TOKEN ??= 'test-bot-token';
process.env.TELEGRAM_CHAT_ID ??= 'test-chat-id';
process.env.JWT_SECRET ??= 'test-jwt-secret';

// AES-256-GCM key for device credential encryption at rest — must be 64 hex
// chars. Fixed so encrypted rows stay readable across runs.
process.env.DEVICE_CREDENTIALS_KEY ??= '0'.repeat(63) + '1';
