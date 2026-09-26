// Source: src/infrastructure/billing/utils/spanishAmountInWords.ts

import { describe, it, expect } from '@jest/globals';
import { spanishAmountInWords } from '../../../../src/infrastructure/billing/utils/spanishAmountInWords';

describe('spanishAmountInWords', () => {
  it.each([
    [0, 'CERO PESOS M/CTE'],
    [1, 'UN PESO M/CTE'],
    [16, 'DIECISÉIS PESOS M/CTE'],
    [21, 'VEINTIÚN PESOS M/CTE'],
    [45, 'CUARENTA Y CINCO PESOS M/CTE'],
    [100, 'CIEN PESOS M/CTE'],
    [101, 'CIENTO UN PESOS M/CTE'],
    [500, 'QUINIENTOS PESOS M/CTE'],
    [1000, 'MIL PESOS M/CTE'],
    [21000, 'VEINTIÚN MIL PESOS M/CTE'],
    [31000, 'TREINTA Y UN MIL PESOS M/CTE'],
    [100000, 'CIEN MIL PESOS M/CTE'],
    [185000, 'CIENTO OCHENTA Y CINCO MIL PESOS M/CTE'],
    [1000000, 'UN MILLÓN DE PESOS M/CTE'],
    [1510000, 'UN MILLÓN QUINIENTOS DIEZ MIL PESOS M/CTE'],
    [2000000, 'DOS MILLONES DE PESOS M/CTE'],
    [21000000, 'VEINTIÚN MILLONES DE PESOS M/CTE'],
    [
      1234567,
      'UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS M/CTE'
    ]
  ])('[BIL-230] writes %p as "%s"', (amount, expected) => {
    expect(spanishAmountInWords(amount)).toBe(expected);
  });

  it('[BIL-230] appends centavos when the amount has cents', () => {
    expect(spanishAmountInWords(1500.5)).toBe(
      'MIL QUINIENTOS PESOS CON CINCUENTA CENTAVOS M/CTE'
    );
    expect(spanishAmountInWords(10.01)).toBe(
      'DIEZ PESOS CON UN CENTAVO M/CTE'
    );
  });

  it('[BIL-230] does not drift on floating-point cents', () => {
    expect(spanishAmountInWords(0.1 + 0.2)).toBe(
      'CERO PESOS CON TREINTA CENTAVOS M/CTE'
    );
  });
});
