export const OPTIONAL_MODULES = [
  'customers',
  'billing',
  'quoting',
  'tickets',
  'enforcement'
] as const;

export type OptionalModule = (typeof OPTIONAL_MODULES)[number];

// `monitoring` names the core that every install runs (inventory, device and
// wireless monitoring, notifications, identity); it cannot be switched off.
const CORE_MODULE = 'monitoring';

const REQUIRES: Partial<Record<OptionalModule, OptionalModule>> = {
  billing: 'customers',
  quoting: 'customers',
  enforcement: 'customers'
};

export class EnabledModules {
  private constructor(
    private readonly modules: ReadonlySet<OptionalModule>
  ) {}

  static all(): EnabledModules {
    return new EnabledModules(new Set(OPTIONAL_MODULES));
  }

  // Unset means every module so an install that predates the switch keeps
  // running exactly as before. A bad value stops the boot: a module silently
  // left on or off is worse than a process that refuses to start.
  static parse(raw: string | undefined): EnabledModules {
    if (raw === undefined || raw.trim() === '')
      return EnabledModules.all();

    const modules = new Set<OptionalModule>();
    for (const token of raw.split(',')) {
      const name = token.trim().toLowerCase();
      if (name === '' || name === CORE_MODULE) continue;
      if (!(OPTIONAL_MODULES as readonly string[]).includes(name)) {
        throw new Error(
          `ENABLED_MODULES: unknown module "${name}". Valid: ${[CORE_MODULE, ...OPTIONAL_MODULES].join(', ')}`
        );
      }
      modules.add(name as OptionalModule);
    }

    for (const module of modules) {
      const required = REQUIRES[module];
      if (required && !modules.has(required)) {
        throw new Error(
          `ENABLED_MODULES: "${module}" requires "${required}"`
        );
      }
    }

    return new EnabledModules(modules);
  }

  has(module: OptionalModule): boolean {
    return this.modules.has(module);
  }

  toString(): string {
    return [
      CORE_MODULE,
      ...OPTIONAL_MODULES.filter((m) => this.has(m))
    ].join(',');
  }
}
