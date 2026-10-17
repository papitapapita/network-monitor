// SwOS serves its settings as `.b` files: a JavaScript-like object with bare
// keys, hex numbers and single-quoted strings, e.g.
// `{en:0x1f,nm:['506f727431','506f727432'],poe:[0x00,0x01]}`.
export function parseSwOsB(text: string): unknown {
  const json = text
    .trim()
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/0x([0-9a-fA-F]+)/g, (_, hex: string) =>
      String(parseInt(hex, 16))
    );
  return JSON.parse(json);
}

// Text values (port names, the version) are hex-encoded bytes.
export function decodeSwOsString(hex: unknown): string | null {
  if (typeof hex !== 'string' || !/^([0-9a-fA-F]{2})*$/.test(hex))
    return null;
  return Buffer.from(hex, 'hex').toString('latin1');
}
