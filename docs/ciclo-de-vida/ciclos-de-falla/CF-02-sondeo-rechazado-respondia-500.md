# CF-02 — Un sondeo rechazado por el sistema respondía 500

| Campo                                 | Valor                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| Fechas de corrección                  | 2026-09-25 (backend) · 2026-09-26 (frontend)                                        |
| Commits                               | backend `0f71707`, `c155c09` · frontend `90ab5d6`                                   |
| Contexto                              | Device Monitoring y Wireless Monitoring — sondeo manual y configuración inalámbrica |
| Regla de negocio                      | `DEV-086` (corregida)                                                               |
| Tipo de mantenimiento (ISO/IEC 14764) | Correctivo                                                                          |
| Fecha de detección · quién · impacto  | `[CONFIRMAR]`                                                                       |

## 1. Identificación

Un sondeo forzado sobre un dispositivo que el sistema se niega a sondear (retirado, borrado o sin monitoreo) respondía **500**, igual que un fallo interno. En la interfaz, cualquier **409** se leía como «monitoreo deshabilitado», aunque el motivo fuera otro. Cómo se detectó: `[CONFIRMAR]`.

## 2. Análisis de causa raíz

Los controladores traducen el texto del error de un caso de uso a un código HTTP mediante una tabla de coincidencias de mensajes. Cuatro mensajes no estaban en la tabla y caían al valor por defecto, 500:

| Controlador          | Mensaje sin mapear                                                      | Estado correcto |
| -------------------- | ----------------------------------------------------------------------- | --------------- |
| `PollingController`  | `Cannot poll device <id> — the device no longer exists`                 | 404             |
| `PollingController`  | `Device is <STATUS> and is not polled`                                  | 409             |
| `WirelessController` | `Cannot poll device — the device no longer exists`                      | 404             |
| `WirelessController` | `Only WIRELESS_CPE and ACCESS_POINT devices can have a wireless config` | 400             |

Un segundo defecto de fondo: la regla `DEV-086` afirmaba que este camino respondía **400**. La documentación y el comportamiento real ya no coincidían.

## 3. Diseño e implementación de la corrección

| Repositorio | Cambio                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend     | `PollingController`: «ya no existe» → 404; «estado no sondeable» → 409, igual que monitoreo deshabilitado (estado del recurso que rechaza una petición válida). `WirelessController`: 404 y 400 según la tabla. |
| Frontend    | `DevicePollingTab.tsx` distingue los dos 409 por el texto del mensaje (`is not polled`) y añade un mensaje propio para 404: «Este dispositivo ya no existe; es posible que se haya eliminado».                  |

## 4. Pruebas

Backend:

- `PollingController.test.ts` (+41 líneas): 404 cuando el dispositivo ya no existe; bloque `Error Path — 409 Conflict` con `should return 409 when the device status refuses polling`; `should return 404 when the device was deleted before the poll ran`.
- `WirelessController.test.ts` (+47 líneas): `should return 404 when the device was deleted before the poll ran`; `createConfig` → `should return 400 when the device type cannot have a wireless config`.

Frontend: sin prueba automatizada en el commit. `[CONFIRMAR]`

## 5. Documentación actualizada

- `docs/business-rules/device-inventory.md`: `DEV-086` ahora indica que `forceExecution` no anula la elegibilidad y que el rechazo es **409** (estado) o **404** (dispositivo inexistente).
- `docs/BACKEND_API.md`: se documentan las respuestas 404 y 409 del sondeo manual.

## 6. Trazabilidad

| Regla     | Código                                                                                                         | Prueba                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `DEV-086` | `src/presentation/http/controllers/PollingController.ts`, `WirelessController.ts` (tabla de mapeo de mensajes) | `PollingController.test.ts`, `WirelessController.test.ts` |
| `DEV-086` | `src/components/devices/DevicePollingTab.tsx` (frontend)                                                       | Sin prueba automatizada `[CONFIRMAR]`                     |

## 7. Lecciones y mejoras

- Una regla de negocio puede quedar desactualizada respecto del código (aquí, 400 frente a 409/404); actualizarla en el mismo commit que la corrección evita el desfase.
- _Observación del análisis_: traducir errores por el **texto** del mensaje es frágil, porque un mensaje nuevo o reformulado vuelve a producir un 500 sin que nada falle de forma visible. El frontend repite el patrón al distinguir los 409 por texto.
- _Mejora propuesta_: errores de dominio con código tipificado (`DEVICE_NOT_FOUND`, `DEVICE_NOT_POLLABLE`) en lugar de comparar mensajes.
