// The Windows-1252 characters at 0x80–0x9F; every other byte is its own code
// point. Undefined slots (0x81, 0x8D, 0x8F, 0x90, 0x9D) are left out.
const WIN1252_HIGH: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f
};

const UTF8 = new TextDecoder('utf-8', { fatal: true });

// node-routeros reads every word as Windows-1252, but RouterOS keeps the
// bytes it was given, and WebFig, the terminal and AirOS hostnames give
// UTF-8: "Virgüez" arrives as "VirgÃ¼ez". Text whose bytes form valid UTF-8
// is read as UTF-8; anything else (typed in Winbox on Windows) stays as read.
export function fromRouterOsText(text: string): string {
  if (!/[^ -~\t\r\n]/.test(text)) return text;
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const byte =
      code <= 0xff && (code < 0x80 || code > 0x9f)
        ? code
        : WIN1252_HIGH[char];
    if (byte === undefined) return text;
    bytes.push(byte);
  }
  try {
    return UTF8.decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}
