// A numeric chat id (groups and supergroups are negative) or a public
// channel's @username, the two forms the Bot API accepts as chat_id. Shared by
// the customer's alert chat (NOT-200) and the vendor's (INS-028).
const TELEGRAM_CHAT_ID = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

export function isTelegramChatId(value: string): boolean {
  return TELEGRAM_CHAT_ID.test(value);
}
