# CF-04 — Pruebas desactivadas, duplicadas y suites de integración rotas

| Campo                                 | Valor                                      |
| ------------------------------------- | ------------------------------------------ |
| Fecha de corrección                   | 2026-09-25                                 |
| Commits (backend)                     | `38e4a66`, `9d12406`, `26017fa`, `9ca49d5` |
| Contexto                              | Pruebas unitarias y de integración         |
| Tipo de mantenimiento (ISO/IEC 14764) | Correctivo + preventivo                    |
| Fecha de detección · quién · impacto  | `[CONFIRMAR]`                              |

> **Nivel de verificación.** Las cifras de pruebas (7846 unitarias; 103 suites y 1280 pruebas de integración) son las que informan los commits; no se reejecutaron al elaborar este documento. Sí se verificó por ejecución el comportamiento de Jest sobre el commit anterior a `38e4a66` (sección 2.1), porque contradice la explicación del propio commit.

## 1. Identificación

Dos problemas distintos, tratados en la misma jornada:

1. **Convención y cobertura de las pruebas unitarias:** una prueba desactivada por defecto, archivos con dos extensiones (`.spec.ts` y `.test.ts`) y una suite duplicada.
2. **Suites de integración en rojo**, por desfase entre las pruebas y el código que había evolucionado.

Cómo se detectaron: `[CONFIRMAR]` (los commits informan el resultado de la suite completa, no el momento del hallazgo).

## 2. Análisis de causa raíz

### 2.1 Pruebas unitarias (`38e4a66`)

| Hallazgo                                                                                                        | Causa                                                                                                                         | Corrección                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La prueba de duración de `UseCase` estaba **desactivada por defecto** (`it.skip` salvo `RUN_TIMING_TESTS=true`) | Fallaba de forma intermitente con el reloj real bajo carga paralela y llegó a CI como prueba inestable; se dejó como opcional | Usa temporizadores falsos de Jest y afirma exactamente 100 ms; corre siempre; se elimina el script `test:timing`                                                                    |
| Pruebas de `ArpService`, `NetworkScannerService` y `expandCidr` en archivos `*.spec.ts` (33 pruebas)            | Dos convenciones de nombre conviviendo en el proyecto                                                                         | Renombradas a `*.test.ts`; todas pasan                                                                                                                                              |
| `ScanNetworkSegmentUseCase` con `.spec.ts` y `.test.ts` a la vez                                                | Suite duplicada; cuatro casos existían solo en el `.spec.ts`                                                                  | Los cuatro casos pasan al `.test.ts` (segmento inexistente, cantidad de hosts de un /30, el escáner lanza un `Error` y lanza un valor que no es `Error`) y se elimina el `.spec.ts` |

Resultado informado por el commit: **7846 pruebas unitarias pasadas, ninguna omitida.**

> **Observación del análisis (verificada).** El mensaje de `38e4a66` afirma que los archivos `.spec.ts` «nunca» eran detectados por Jest. Al ejecutar `npx jest --listTests` sobre el commit anterior (`38e4a66~1`), Jest **sí lista** los cuatro archivos `.spec.ts` (incluidos los dos de `ScanNetworkSegmentUseCase`): `jest.config.js` no restringe la extensión. La restricción a `*.test.ts` existe en la configuración de **integración** (`jest.integration.config.js`, `testMatch`), donde un `.spec.ts` sí se omite sin aviso. Por lo tanto, la corrección unifica la convención y elimina duplicados, pero **no recupera pruebas inactivas**; lo único que realmente estaba omitido en las pruebas unitarias era la prueba de duración. `[CONFIRMAR]` con el autor la intención original del mensaje.

### 2.2 Suites de integración desactualizadas (`9d12406`, `26017fa`)

Causas según el mensaje del commit `9d12406`:

| Hallazgo                                                                     | Causa                                                                              | Corrección                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 30 peticiones de `alert.routes` y `polling.routes` respondían 401            | Las pruebas son anteriores a `createAuthenticateMiddleware`                        | Envían token `Bearer`; `alert.routes` gana una prueba de 401                                                                         |
| `polling.routes` fallaba pasada la autenticación                             | El dominio ahora exige ubicación y estado `ACTIVE` antes de habilitar el monitoreo | El dispositivo de prueba se crea `ACTIVE` y con ubicación                                                                            |
| `scan.routes` construía su propia aplicación con `jest.mock` del caso de uso | `jest.mock` falla con ESM y no es una prueba de integración                        | Reescrita sobre el contenedor real; `createTestApp` acepta un gancho de configuración; `FakeNetworkScannerService` gana `failWith()` |
| «Sin configuración de sondeo» de `ExecutePollingCycle`                       | Usaba un id inexistente, que la verificación de elegibilidad rechaza antes         | Usa un dispositivo elegible real; una segunda prueba fija el caso de dispositivo inexistente (`DEV-086`)                             |
| Pruebas de `DEV-087` (`SendDeviceDownAlert` y `SendDeviceRecoveryAlert`)     | Escribían `'operator'` en `deleted_by`, columna de tipo **UUID**                   | Valor UUID válido                                                                                                                    |
| `npm run test:integration` agotaba la memoria hacia la suite 32 de 103       | `--runInBand` acumula memoria en un solo proceso                                   | Un único _worker_ reciclado: sigue siendo serial contra la base de datos de pruebas y termina en unos 3 minutos                      |
| Pruebas de rutas inalámbricas (`26017fa`)                                    | Peticiones sin token                                                               | `Bearer` en todas las peticiones                                                                                                     |

Resultado informado: **103 de 103 suites y 1280 pruebas de integración pasando.**

## 3. Diseño e implementación

Lo común a los dos problemas es que **la prueba dejó de reflejar el código, o dejó de proteger, sin que nada lo hiciera visible**. La corrección arregla cada caso (tablas anteriores) y mejora la visibilidad:

- `9ca49d5`: las pruebas de `WLS-099` y `WLS-163` citan ahora el ID de su regla en el título, de modo que el script de cobertura de reglas las encuentre.

## 4. Verificación

- `npm test` (unitarias): 7846 pasadas, 0 omitidas (cifra del commit, al 2026-09-25).
- `npm run test:integration`: 103 suites, 1280 pruebas (cifra del commit, al 2026-09-25).
- Mecanismo permanente: `scripts/check-rule-coverage.mjs` falla si una regla del libro de reglas no tiene ninguna prueba que cite su ID, o si una prueba cita un ID que ninguna regla declara. El pipeline `ci.yml` ejecuta hoy los trabajos `lint`, `typecheck`, `unit`, `rules-dev`, `integration-usecases` e `integration-routes`; la verificación de reglas cubre solo el contexto `DEV` (comentario del propio workflow). `[CONFIRMAR]` si se ampliará a los demás contextos.

## 5. Documentación

`CLAUDE.md` del backend recoge hoy las convenciones relevantes: extensión `.test.ts` («`.spec.ts` is silently skipped»), integración en dos capas (pruebas de ruta y pruebas por caso de uso), base de datos de pruebas separada y fixtures `clean*`, `seed*` y `Fake*`. El estándar completo está en `docs/rules/TESTING-INTEGRATION-STANDARD.md`.

## 6. Trazabilidad

| Elemento                                        | Evidencia                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Configuración unitaria (no restringe extensión) | `jest.config.js`                                                                                             |
| Configuración de integración (solo `*.test.ts`) | `jest.integration.config.js` (`testMatch`)                                                                   |
| Cobertura regla → prueba                        | `scripts/check-rule-coverage.mjs`, `docs/business-rules/*.md`, ID entre corchetes en los títulos de `tests/` |
| Ejecución automática                            | `.github/workflows/ci.yml`                                                                                   |

## 7. Lecciones y mejoras

- Una prueba desactivada con una variable de entorno deja de proteger; hacerla determinista (temporizadores falsos) es mejor que volverla opcional.
- Las pruebas de integración se desactualizan cuando el dominio añade restricciones (autenticación, invariantes de ubicación y estado); hay que ejecutarlas en cada cambio y no solo antes de entregar.
- Un mensaje de commit es una afirmación, no una prueba: aquí se contrastó con la ejecución y la explicación resultó imprecisa. Conviene verificar la causa antes de documentarla.
- _Mejora propuesta_: un paso de CI que falle si existe algún `*.spec.ts` bajo `tests/`, porque en la configuración de integración se omitiría sin aviso.
