# Documentación del ciclo de vida del software

**Proyecto:** Sistema de gestión y monitoreo de red — backend `network-monitor` y frontend `network-monitor-frontend`
**Autor:** Jonathan David Ramírez Olivos · Universidad Compensar · Prácticas
**Elaborado:** 2026-10-08 · **Versión del documento:** 0.1 (borrador para revisión)

---

## 1. Qué es este documento y qué no es

Este conjunto de documentos describe **cómo está diseñado y construido el producto** (documentación _as-built_) y reconstruye, a partir del historial de Git, **ocho ciclos completos de corrección de fallas** ocurridos entre el **21 de septiembre y el 6 de octubre de 2026**.

- **Es** documentación elaborada _después_ de los hechos, a partir de evidencia verificable: commits de ambos repositorios, reglas de negocio con ID, pruebas, ADRs y el pipeline de integración continua.
- **No es** un registro contemporáneo. Las fechas citadas son las de los commits (hora de Bogotá); ningún documento está fechado retroactivamente. La fecha de elaboración está en el encabezado.
- Todo dato que el código y el historial **no permiten saber** (quién detectó una falla, cuánto afectó, por qué se eligió una solución) está marcado como `[CONFIRMAR]` para que lo complete el autor. Nada de eso se ha inventado.

## 2. El sistema en una página

| Aspecto              | Backend (`network-monitor`)                                                                                                                                                                                                   | Frontend (`network-monitor-frontend`)                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tecnología           | Node.js, TypeScript, Express, Prisma, PostgreSQL, Jest                                                                                                                                                                        | Next.js (App Router), React Query, Playwright        |
| Arquitectura         | Clean Architecture + DDD: `presentation → application → domain ← infrastructure`                                                                                                                                              | Páginas en `app/`, componentes y servicios en `src/` |
| Organización         | 11 contextos de aplicación (billing, customers, device-inventory, device-monitoring, identity, notifications, probe-agents, quoting, service-enforcement, tickets, wireless-monitoring) + núcleo compartido (`domain/shared`) | Consume la API REST del backend                      |
| Reglas de negocio    | 13 archivos en `docs/business-rules/`, cada regla con ID permanente (p. ej. `DEV-148`, `MON-021`, `NOT-097`), tipo, estado y justificación (_Why_)                                                                            | —                                                    |
| Pruebas              | `tests/`: unitarias, de integración con base de datos real y del agente                                                                                                                                                       | `e2e/`: pruebas de extremo a extremo con Playwright  |
| Integración continua | `.github/workflows/ci.yml`: lint, typecheck, pruebas unitarias, cobertura de reglas y pruebas de integración                                                                                                                  | No hay carpeta `.github` en el repositorio           |

Convenciones de trabajo observables en el historial: mensajes de commit según _Conventional Commits_ (`feat`, `fix`, `test`, `docs`, `refactor`, `build`), una regla de negocio por comportamiento y pruebas que citan el ID de la regla en el título (`it('[DEV-148] …')`).

## 3. Mapa del ciclo de vida

| Fase           | Evidencia en los repositorios                                                                                                                                                          | Dónde se documenta                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Requisitos     | `docs/business-rules/` (reglas con ID, tipo _Invariant / Validation / Policy_, estado, motivo), `docs/UBIQUITOUS-LANGUAGE.md`                                                          | Cada ciclo de falla nombra la regla afectada                     |
| Diseño         | `docs/adr/0001-alert-publishing-contract.md`, `docs/adr/0002-on-site-probe-agent.md`, `docs/DOMAIN-CORE.md`, `docs/rules/*-STANDARD.md`, `docs/BACKEND_API.md`, `prisma/schema.prisma` | Pendiente: arquitectura _as-built_ y modelo de datos (sección 7) |
| Implementación | Estructura por capas, inyección de dependencias en `src/infrastructure/di/container.ts`, historial de commits                                                                          | CF-05                                                            |
| Pruebas        | `tests/` (unitarias, integración), `e2e/`, script `scripts/check-rule-coverage.mjs` que exige al menos una prueba por regla                                                            | CF-04 y la sección _Verificación_ de cada ciclo                  |
| Despliegue     | `Dockerfile`, `deploy/`, scripts de instalación por cliente (commits `0bac330`, `c8ef6b3`)                                                                                             | Pendiente (sección 7)                                            |
| Mantenimiento  | Corrección de fallas, parches de seguridad, ajuste de contratos entre backend y frontend                                                                                               | CF-01 … CF-08                                                    |

## 4. Ciclos de falla documentados

Cada ciclo recorre el proceso de mantenimiento: identificación → análisis → diseño de la corrección → implementación → pruebas → documentación → entrega. Se clasifican según la norma ISO/IEC 14764 (correctivo, adaptativo, perfectivo, preventivo). Método y plantilla en [`ciclos-de-falla/README.md`](ciclos-de-falla/README.md).

| ID                                                                          | Falla                                                                  | Fecha de corrección | Repos                | Mantenimiento           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- | -------------------- | ----------------------- |
| [CF-01](ciclos-de-falla/CF-01-sondeo-manual-excede-proxy.md)                | El sondeo manual superaba el tiempo máximo del proxy                   | 2026-09-25          | backend, frontend    | Correctivo              |
| [CF-02](ciclos-de-falla/CF-02-sondeo-rechazado-respondia-500.md)            | Un sondeo rechazado por el sistema respondía 500                       | 2026-09-25 / 09-26  | backend, frontend    | Correctivo              |
| [CF-03](ciclos-de-falla/CF-03-filtro-conectividad-pierde-dispositivos.md)   | El filtro de conectividad perdía dispositivos por límite de peticiones | 2026-09-26 / 09-28  | backend, frontend    | Correctivo + perfectivo |
| [CF-04](ciclos-de-falla/CF-04-pruebas-desactivadas-y-suites-rotas.md)       | Pruebas desactivadas, duplicadas y suites de integración rotas         | 2026-09-25          | backend              | Correctivo + preventivo |
| [CF-05](ciclos-de-falla/CF-05-cableado-di-no-compilaba.md)                  | El contenedor de dependencias impedía compilar                         | 2026-09-25          | backend              | Correctivo              |
| [CF-06](ciclos-de-falla/CF-06-alerta-caida-fecha-equivocada.md)             | La alerta de caída diferida informaba la hora equivocada               | 2026-09-25          | backend              | Correctivo              |
| [CF-07](ciclos-de-falla/CF-07-rol-vendor-y-permisos-en-interfaz.md)         | El rol VENDOR y los permisos no se reflejaban en la interfaz           | 2026-09-30          | frontend (+ backend) | Correctivo + adaptativo |
| [CF-08](ciclos-de-falla/CF-08-vulnerabilidades-y-cabeceras-de-seguridad.md) | Vulnerabilidades en dependencias y falta de cabeceras de seguridad     | 2026-10-01 / 10-06  | frontend             | Preventivo + correctivo |

Contexto cuantitativo del período (detalle en [`cronologia.md`](cronologia.md)): **148 commits** (83 backend, 65 frontend), de los cuales **20 son correcciones** (`fix`).

## 5. Relación con las materias

| Materia                                 | Qué muestra este material                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundamentos de Construcción de Software | Requisitos como reglas con ID y justificación; cómo una falla corrige o crea una regla (CF-01, CF-02, CF-06); trazabilidad regla → código → prueba; separación en capas (CF-05); gestión de configuración con Git |
| Bases de Datos                          | Consulta de lectura sobre `device` y `device_states` y su separación del repositorio de escritura (CF-03); restricciones de tipo en columnas (`deleted_by` es UUID, CF-04)                                        |
| Pruebas de Software                     | Prueba desactivada por inestable, suites de integración desactualizadas, una prueba que verificaba el comportamiento erróneo (CF-04, CF-06), pruebas por capa y cobertura de reglas con ID                        |

## 6. Convenciones de lectura

- `[CONFIRMAR]`: dato que solo el autor puede aportar (detección, impacto, decisión).
- `Observación del análisis`: lectura propia de la evidencia, no afirmada por el commit.
- `Mejora propuesta`: sugerencia no implementada.
- Los hashes (`2bf606e`) permiten abrir cada commit con `git show <hash>` en el repositorio indicado.

## 7. Documentos pendientes

1. **Especificación de requisitos _as-built_** derivada de `docs/business-rules/`, con matriz de trazabilidad regla → código → prueba generada con `scripts/check-rule-coverage.mjs`.
2. **Modelo de datos** (diagrama entidad-relación y diccionario desde `prisma/schema.prisma`).
3. **Estrategia y plan de pruebas** (pirámide, entornos, cobertura de reglas, e2e).
4. **Arquitectura _as-built_** (vistas C4, ADRs 0001 y 0002 explicados).
5. **Despliegue y operación** (imagen por cliente, scripts de instalación, actualización firmada del agente).
6. **Informe final** con métricas y lecciones aprendidas.

## 8. Nota de transparencia sobre herramientas

Varios commits de este período incluyen la línea `Co-Authored-By` de un asistente de IA (Claude, de Anthropic), y estos documentos fueron redactados con ayuda del mismo tipo de herramienta, a partir de la lectura del repositorio. `[CONFIRMAR]` la política de la universidad y del docente sobre el uso de asistentes de IA, y declarar su uso en el informe final con la redacción que corresponda.
