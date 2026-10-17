// PWR-001: the firmware a PoE-out switch model runs. A model without one is
// not a PoE switch.
export enum PoeSwitchOs {
  ROUTEROS = 'ROUTEROS',
  SWOS = 'SWOS'
}

export function isPoeSwitchOs(value: unknown): value is PoeSwitchOs {
  return (
    typeof value === 'string' &&
    (Object.values(PoeSwitchOs) as string[]).includes(value)
  );
}
