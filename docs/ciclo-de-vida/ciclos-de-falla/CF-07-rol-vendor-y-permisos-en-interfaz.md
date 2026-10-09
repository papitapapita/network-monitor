# CF-07 — El rol VENDOR y los permisos no se reflejaban en la interfaz

| Campo                                 | Valor                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Fechas                                | 2026-09-29 (cambios de contrato en el backend) · 2026-09-30 (correcciones en el frontend)                |
| Commits                               | backend `cc64e23`, `4a137a1` · frontend `dd91316`, `52ed9cb`, `5b18a83`, `aa114b1`, `212cd2c`, `c48a937` |
| Contexto                              | Identity & Access, Installation (suscripción) y toda la interfaz                                         |
| Reglas de negocio                     | `IDN-020`, `IDN-030`, `IDN-033`, `IDN-034`, `INS-020`                                                    |
| Tipo de mantenimiento (ISO/IEC 14764) | Correctivo + adaptativo                                                                                  |
| Fecha de detección · quién · impacto  | `[CONFIRMAR]`                                                                                            |

## 1. Identificación

Dos síntomas que aparecieron al cambiar el contrato de la API:

1. Una cuenta con el rol nuevo **VENDOR** veía toda la aplicación como si fuera de solo lectura.
2. Un usuario **VIEWER**, o una instalación con suscripción en solo lectura, veía botones (editar, suspender, marcar como pagada, eliminar, sondear) que la API rechazaba con **403** o **402**.

Cómo se detectaron: `[CONFIRMAR]`.

## 2. Análisis de causa raíz

### 2.1 El cambio de contrato (backend, 2026-09-29)

- `cc64e23`: nuevo rol **VENDOR**, por encima de ADMIN, con el permiso adicional `manage-installation` (`IDN-033`, `AGT-009`). La cuenta del proveedor se crea al arrancar desde `VENDOR_EMAIL` y `VENDOR_PASSWORD` (`IDN-011`), con contraseña de 12 o más caracteres (`IDN-012`). Incluye migración que añade el valor al enumerado.
- `4a137a1`: una suscripción vencida escala de gracia a **solo lectura** (las escrituras responden **402**) y luego a **bloqueada** (`INS-020` a `INS-027`).

El contrato quedó documentado en `docs/BACKEND_API.md` (sección de roles), que el frontend cita así: «wherever an endpoint lists ADMIN, VENDOR is allowed too».

### 2.2 Por qué falló el frontend (2026-09-30)

| Causa                                                                                                                                                                                                      | Efecto                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Cada verificación de rol comparaba contra la cadena `'ADMIN'` en 12 archivos                                                                                                                               | Un VENDOR no era reconocido como administrador y la interfaz quedaba en solo lectura |
| Páginas de detalle de proveedores, modelos de dispositivo, ubicaciones, clientes (y sus servicios contratados), planes de servicio, facturas, cuentas de cobro y cotizaciones **nunca comprobaban el rol** | Ofrecían acciones que la API rechazaba con 403 o 402                                 |
| Controles compartidos (`EditToggleButton`, `DataTable`) sin conocimiento del rol ni de la suscripción                                                                                                      | El mismo problema en todas las listas                                                |

## 3. Diseño e implementación de la corrección

| Commit    | Cambio                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dd91316` | Se centraliza la lógica en `src/constants/roles.ts` con `isAdminRole` (ADMIN o VENDOR), `canWriteRole` (todos menos VIEWER) e `isVendorRole`; `UserRole` incluye VENDOR; se reemplazan las comparaciones literales en 12 archivos (14 modificados en total) |
| `5b18a83` | Las páginas de detalle exigen escritura para editar o cambiar estados y ADMIN para eliminar; el listado de facturas oculta «Generar Factura» y «Generación Masiva»                                                                                          |
| `aa114b1` | En las pestañas del dispositivo: «Sondear ahora» y «Habilitar Monitoreo» exigen escritura; «Restablecer a valores por defecto» exige escritura; borrar la configuración inalámbrica es solo ADMIN                                                           |
| `52ed9cb` | `EditToggleButton` oculta el lápiz a quien no puede escribir; `DataTable` quita la selección de filas sin permiso de escritura y la eliminación masiva a quien no es ADMIN                                                                                  |

La interfaz oculta lo que el usuario no puede ejecutar; **la autoridad sigue siendo la API**, que continúa respondiendo 403 o 402 si alguien llama directamente.

## 4. Pruebas

Frontend, pruebas de extremo a extremo con Playwright:

- `212cd2c`: cubre agentes, las etapas de suscripción, usuarios y los interruptores de la instalación.
- `c48a937` (`e2e/subscription.spec.ts`, +15 líneas): «una página de dispositivo de solo lectura no ofrece escrituras en ninguna pestaña». Cierra el ítem «botones de solo lectura» de `TODOS.md`.

Backend: las reglas `IDN-033` y `IDN-034` tienen su cobertura en las pruebas de identidad; el commit del frontend no modifica pruebas del backend.

## 5. Documentación actualizada

- Backend: `docs/business-rules/identity.md` (134 líneas modificadas), `docs/business-rules/probe-agents.md`, `docs/business-rules/installation.md` (`INS-020` a `INS-027`), `docs/BACKEND_API.md` (52 líneas modificadas) y `docs/adr/0002-on-site-probe-agent.md`.
- Frontend: `TODOS.md` (ítem cerrado).

## 6. Trazabilidad

| Regla                                      | Código                                                      | Prueba                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `IDN-020`                                  | `src/domain/identity/value-objects/UserRole.ts` (backend)   | `tests/domain/identity/value-objects/UserRole.test.ts`                                           |
| `IDN-030`                                  | `src/domain/identity/permissions/Permission.ts` (backend)   | `tests/domain/identity/permissions/Permission.test.ts`                                           |
| `IDN-033`                                  | `src/domain/identity/permissions/Permission.ts` (backend)   | `Permission.test.ts`, `tests/integration/admin.routes.test.ts`                                   |
| `IDN-034`                                  | `Permission.ts` (backend)                                   | `Permission.test.ts`, `tests/integration/notification-settings.routes.test.ts`                   |
| `INS-020`                                  | Estados de suscripción: `4a137a1` (backend)                 | `SubscriptionTerms.test.ts`, `GetSubscriptionStatusUseCase.test.ts` y su prueba de integración   |
| Frontend (`IDN-033`, `IDN-034`, `INS-020`) | `src/constants/roles.ts`; `017455e` (etapas de suscripción) | `e2e/subscription.spec.ts`, `e2e/users.spec.ts`, `e2e/agents.spec.ts` y las pruebas de `212cd2c` |

## 7. Lecciones y mejoras

- Un cambio de contrato entre repositorios necesita un seguimiento explícito del lado consumidor: el rol y los estados de suscripción llegaron al backend el 29 de septiembre y la interfaz se corrigió el día siguiente.
- Centralizar una decisión (`roles.ts`) elimina la clase entera de errores de comparación literal; el comentario del archivo lo dice: «para que los dos no vuelvan a desfasarse».
- _Observación del análisis_: ocultar un botón es usabilidad, no seguridad. La combinación correcta es la que existe aquí: interfaz que oculta y API que impone.
- _Mejora propuesta_: tipos del contrato generados desde la especificación de la API, para que un rol o estado nuevo rompa la compilación del frontend en lugar de una pantalla.
