// "24.1", "24.1V", "2.5W", "120mA": the number, without its unit.
export function parseMeasure(
  value: string | undefined
): number | null {
  if (value === undefined) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function withTimeout<T>(
  work: Promise<T>,
  ms: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${ms} ms`)),
      ms
    );
  });
  return Promise.race([work, timeout]).finally(() =>
    clearTimeout(timer)
  );
}
