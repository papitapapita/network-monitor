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

// Baked into pairing keys; agents are never actually contacted in tests.
process.env.AGENT_PUBLIC_URL ??= 'https://agents.test.local';

// Cuenta de cobro issuer: the env default for the vendor's issuer setting
// (BIL-232), so the billing suites can print a PDF.
process.env.ISSUER_NAME ??= 'Test ISP';
process.env.ISSUER_DOCUMENT ??= '900123456-7';
process.env.ISSUER_ADDRESS ??= 'Calle 1 # 2-3';
process.env.ISSUER_CITY ??= 'Villavicencio';
process.env.ISSUER_CONTACT_PHONE ??= '300 000 0000';
process.env.ISSUER_CONTACT_EMAIL ??= 'billing@test-isp.example';
