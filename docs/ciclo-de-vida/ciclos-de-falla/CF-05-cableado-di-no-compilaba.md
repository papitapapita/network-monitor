# CF-05 — El contenedor de dependencias impedía compilar el proyecto

| Campo                                 | Valor                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Fecha de corrección                   | 2026-09-25                                                                            |
| Commit (backend)                      | `5d95c27`                                                                             |
| Origen                                | `4f60067` — funcionalidad de intercambio de hardware entre dispositivos (misma fecha) |
| Contexto                              | Device Inventory — inyección de dependencias                                          |
| Tipo de mantenimiento (ISO/IEC 14764) | Correctivo                                                                            |
| Fecha de detección · quién · impacto  | `[CONFIRMAR]`                                                                         |

## 1. Identificación

Desde que se incorporó el intercambio de hardware, el proyecto **no pasaba la verificación de tipos** (`tsc --noEmit`). Cómo se detectó: `[CONFIRMAR]` si fue localmente o por el trabajo `typecheck` del pipeline de integración continua, que existe desde 2026-08-11.

## 2. Análisis de causa raíz

El contenedor de dependencias (`src/infrastructure/di/container.ts`) construye `DeviceController` pasando una larga lista de casos de uso **por posición**. Al añadir `SwapDeviceHardwareUseCase`, el constructor lo espera **antes** de `PermanentlyDeleteDeviceUseCase`, pero la llamada en el contenedor los pasaba en el orden contrario. Como son clases distintas, el compilador lo señala como error de tipo.

| Posición | Constructor espera               | El contenedor pasaba             |
| -------- | -------------------------------- | -------------------------------- |
| n        | `swapDeviceHardwareUseCase`      | `permanentlyDeleteDeviceUseCase` |
| n + 1    | `permanentlyDeleteDeviceUseCase` | `swapDeviceHardwareUseCase`      |

## 3. Diseño e implementación de la corrección

Tres inserciones y tres eliminaciones en `container.ts`: los dos argumentos vuelven al orden del constructor y se reordena el `import` de los casos de uso. No cambia el comportamiento en ejecución.

## 4. Pruebas

El commit no añade pruebas. La verificación es el propio compilador (`npm run typecheck`). `[CONFIRMAR]` si se ejecutó la suite completa tras la corrección.

## 5. Documentación actualizada

Ninguna. Es un defecto de ensamblaje sin efecto sobre las reglas de negocio.

## 6. Trazabilidad

| Elemento               | Evidencia                                                                       |
| ---------------------- | ------------------------------------------------------------------------------- |
| Defecto introducido en | `4f60067` — `feat(device-inventory): swap hardware between two working devices` |
| Código corregido       | `src/infrastructure/di/container.ts` (llamada a `new DeviceController(...)`)    |
| Control que lo detecta | `npm run typecheck` · trabajo `typecheck` en `.github/workflows/ci.yml`         |

## 7. Lecciones y mejoras

- El tipado estático detectó el error antes de llegar a ejecución, que es su función; el valor está en ejecutar `typecheck` en cada cambio.
- _Observación del análisis_: un constructor con una lista larga de parámetros posicionales invita a este tipo de intercambio, y solo el tipo distinto de cada argumento lo hace visible. Si dos casos de uso compartieran la misma firma, el error pasaría el compilador.
- _Mejora propuesta_: pasar los casos de uso a los controladores como un objeto con nombres (`{ swapDeviceHardware, permanentlyDeleteDevice, … }`).
