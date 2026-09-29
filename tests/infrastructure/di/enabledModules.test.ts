// Source: src/infrastructure/di/enabledModules.ts

import { describe, it, expect } from '@jest/globals';
import {
  EnabledModules,
  OPTIONAL_MODULES
} from '../../../src/infrastructure/di/enabledModules';

describe('EnabledModules.parse', () => {
  it.each([undefined, '', '   '])(
    '[INS-001] enables every module when the setting is %p',
    (raw) => {
      const modules = EnabledModules.parse(raw);

      for (const module of OPTIONAL_MODULES) {
        expect(modules.has(module)).toBe(true);
      }
    }
  );

  it('[INS-002] enables no optional module for a monitoring-only install', () => {
    const modules = EnabledModules.parse('monitoring');

    for (const module of OPTIONAL_MODULES) {
      expect(modules.has(module)).toBe(false);
    }
  });

  it('enables only the listed modules', () => {
    const modules = EnabledModules.parse(
      'monitoring,customers,billing'
    );

    expect(modules.has('customers')).toBe(true);
    expect(modules.has('billing')).toBe(true);
    expect(modules.has('quoting')).toBe(false);
    expect(modules.has('tickets')).toBe(false);
    expect(modules.has('enforcement')).toBe(false);
  });

  it('[INS-002] treats monitoring as implied — it cannot be switched off', () => {
    const modules = EnabledModules.parse('tickets');

    expect(modules.has('tickets')).toBe(true);
    expect(modules.toString()).toBe('monitoring,tickets');
  });

  it('ignores case, whitespace and empty entries', () => {
    const modules = EnabledModules.parse(' Monitoring , TICKETS ,, ');

    expect(modules.has('tickets')).toBe(true);
    expect(modules.has('customers')).toBe(false);
  });

  it('[INS-003] refuses an unknown module name', () => {
    expect(() =>
      EnabledModules.parse('monitoring,invoicing')
    ).toThrow('ENABLED_MODULES: unknown module "invoicing"');
  });

  it.each(['billing', 'quoting', 'enforcement'])(
    '[INS-004] refuses %s without customers',
    (module) => {
      expect(() =>
        EnabledModules.parse(`monitoring,${module}`)
      ).toThrow(`ENABLED_MODULES: "${module}" requires "customers"`);
    }
  );

  it('[INS-004] accepts a module together with the module it requires', () => {
    expect(() =>
      EnabledModules.parse('customers,billing,quoting,enforcement')
    ).not.toThrow();
  });
});
