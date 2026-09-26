const UP_TO_TWENTY_NINE = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve'
];

const TENS = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa'
];

const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos'
];

// "uno" shortens before a noun: "un peso", "veintiún mil", "treinta y un
// millones". `apocope` marks that position.
function shorten(word: string, apocope: boolean): string {
  if (!apocope) return word;
  if (word === 'uno') return 'un';
  if (word === 'veintiuno') return 'veintiún';
  return word;
}

function belowHundred(n: number, apocope: boolean): string {
  if (n < 30) return shorten(UP_TO_TWENTY_NINE[n], apocope);
  const tens = TENS[Math.floor(n / 10)];
  const units = n % 10;
  if (units === 0) return tens;
  return `${tens} y ${shorten(UP_TO_TWENTY_NINE[units], apocope)}`;
}

function belowThousand(n: number, apocope: boolean): string {
  if (n === 100) return 'cien';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest > 0) parts.push(belowHundred(rest, apocope));
  return parts.join(' ');
}

function belowMillion(n: number, apocope: boolean): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (thousands === 1) parts.push('mil');
  else if (thousands > 1)
    parts.push(`${belowThousand(thousands, true)} mil`);
  if (rest > 0) parts.push(belowThousand(rest, apocope));
  return parts.join(' ');
}

export function integerToSpanishWords(
  n: number,
  apocope: boolean = false
): string {
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const parts: string[] = [];
  if (millions === 1) parts.push('un millón');
  else if (millions > 1) {
    parts.push(`${belowMillion(millions, true)} millones`);
  }
  if (rest > 0) parts.push(belowMillion(rest, apocope));
  return parts.join(' ');
}

export function spanishAmountInWords(amount: number): string {
  const totalCents = Math.round(amount * 100);
  const pesos = Math.floor(totalCents / 100);
  const cents = totalCents % 100;

  const pesoWords = integerToSpanishWords(pesos, true);
  // "un millón de pesos", but "un millón cien pesos".
  const unit =
    pesos === 1
      ? 'peso'
      : pesos > 0 && pesos % 1_000_000 === 0
        ? 'de pesos'
        : 'pesos';

  let words = `${pesoWords} ${unit}`;
  if (cents > 0) {
    words += ` con ${integerToSpanishWords(cents, true)} ${cents === 1 ? 'centavo' : 'centavos'}`;
  }

  return `${words} m/cte`.toUpperCase();
}
