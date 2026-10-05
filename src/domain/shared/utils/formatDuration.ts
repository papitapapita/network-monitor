const UNITS: ReadonlyArray<[number, string, string]> = [
  [365 * 86_400, 'año', 'años'],
  [86_400, 'día', 'días'],
  [3_600, 'hora', 'horas'],
  [60, 'minuto', 'minutos'],
  [1, 'segundo', 'segundos']
];

// For people, not parsers: the two largest units, so 1_144_800 s reads
// `13 días y 6 horas` rather than `318 horas`. A zero second unit is dropped
// (`13 días`), and so is one that is not adjacent to the first (2 days and
// 30 s reads `2 días`).
export function formatDuration(totalSeconds: number): string {
  let rest = Math.round(Math.abs(totalSeconds));
  const parts: string[] = [];
  for (const [size, singular, plural] of UNITS) {
    if (parts.length === 2) break;
    const count = Math.floor(rest / size);
    rest -= count * size;
    if (count > 0) {
      parts.push(`${count} ${count === 1 ? singular : plural}`);
    } else if (parts.length === 1) {
      break;
    }
  }
  return parts.length === 0 ? '0 segundos' : parts.join(' y ');
}
