import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Never the production chat, whatever .env.test says: the real container is
// wired in these suites, so every alert a test raises is really sent. They go
// to the agent notifications (vendor) chat instead; without its bot and chat
// the token is fake and Telegram refuses every message.
const testBotToken = process.env.TELEGRAM_VENDOR_BOT_TOKEN?.trim();
const testChatId = process.env.TELEGRAM_VENDOR_CHAT_ID?.trim();
const testChatSet = Boolean(testBotToken && testChatId);
process.env.TELEGRAM_BOT_TOKEN = testChatSet
  ? testBotToken
  : 'test-bot-token';
process.env.TELEGRAM_CHAT_ID = testChatSet
  ? testChatId
  : '-1000000000001';
process.env.TELEGRAM_VENDOR_BOT_TOKEN = 'test-vendor-bot-token';
delete process.env.TELEGRAM_VENDOR_CHAT_ID;
process.env.JWT_SECRET ??= 'test-jwt-secret';

// AES-256-GCM key for device credential encryption at rest — must be 64 hex
// chars. Fixed so encrypted rows stay readable across runs.
process.env.DEVICE_CREDENTIALS_KEY ??= '0'.repeat(63) + '1';

// Baked into pairing keys; agents are never actually contacted in tests.
// Pinned like the Telegram settings: the suites expect these exact values.
process.env.AGENT_PUBLIC_URL = 'https://agents.test.local';
delete process.env.INSTALLERS_DIR;

// Cuenta de cobro issuer: the env default for the vendor's issuer setting
// (BIL-232), so the billing suites can print a PDF.
process.env.ISSUER_NAME ??= 'Test ISP';
process.env.ISSUER_DOCUMENT ??= '900123456-7';
process.env.ISSUER_ADDRESS ??= 'Calle 1 # 2-3';
process.env.ISSUER_CITY ??= 'Villavicencio';
process.env.ISSUER_CONTACT_PHONE ??= '300 000 0000';
process.env.ISSUER_CONTACT_EMAIL ??= 'billing@test-isp.example';
