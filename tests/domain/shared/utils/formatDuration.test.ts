import { formatDuration } from '../../../../src/domain/shared/utils/formatDuration';

describe('formatDuration', () => {
  it.each([
    [0, '0 segundos'],
    [1, '1 segundo'],
    [45, '45 segundos'],
    [60, '1 minuto'],
    [100, '1 minuto y 40 segundos'],
    [3_600, '1 hora'],
    [3_903, '1 hora y 5 minutos'],
    [86_400, '1 día'],
    [312 * 3_600, '13 días'],
    [318 * 3_600, '13 días y 6 horas'],
    [2 * 86_400 + 30, '2 días'],
    [400 * 86_400, '1 año y 35 días'],
    [-90, '1 minuto y 30 segundos']
  ])('formats %i s as "%s"', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
