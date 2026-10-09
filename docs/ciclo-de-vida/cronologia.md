# Cronología del período 21 de septiembre – 6 de octubre de 2026

Fuente: `git log` de ambos repositorios (hora de Bogotá, UTC-5). Cifras generadas con un script sobre el historial, no contadas a mano.

## Commits por día

| Fecha      | Backend | Frontend |
| ---------- | ------: | -------: |
| 2026-09-21 |       1 |        3 |
| 2026-09-25 |      19 |       13 |
| 2026-09-26 |       7 |        6 |
| 2026-09-28 |       9 |        4 |
| 2026-09-29 |      14 |        4 |
| 2026-09-30 |       8 |        9 |
| 2026-10-01 |      12 |        8 |
| 2026-10-05 |      13 |       13 |
| 2026-10-06 |       0 |        5 |
| **Total**  |  **83** |   **65** |

Días sin commits en el rango: 22, 23, 24 y 27 de septiembre; 2, 3 y 4 de octubre. `[CONFIRMAR]` si hubo trabajo no versionado en esos días.

## Commits por tipo

| Tipo       | Backend | Frontend |
| ---------- | ------: | -------: |
| `feat`     |      56 |       43 |
| `fix`      |       6 |       14 |
| `docs`     |      11 |        1 |
| `test`     |       5 |        4 |
| `refactor` |       3 |        2 |
| `build`    |       2 |        1 |

## Hitos por día

| Fecha      | Hitos (resumen de los commits)                                                                                                                                                                                 | Ciclos                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 2026-09-21 | Sondeo de estaciones AirOS 6 mediante el flujo `login.cgi` heredado (backend); Enter envía y Escape cancela formularios, botón mostrar/ocultar contraseña (frontend)                                           |                       |
| 2026-09-25 | Radios Mimosa C5c/C5x por SNMP; capacidad de enlace inferida del plan contratado; horarios de tickets en bloques; intercambio de hardware entre dispositivos. Día de mayor corrección y saneamiento de pruebas | CF-01, 02, 04, 05, 06 |
| 2026-09-26 | Cuentas de cobro (facturación); diagnóstico de enlace en vivo; la lista de dispositivos incluye su conectividad; panel rehecho alrededor de lo que requiere atención                                           | CF-03                 |
| 2026-09-28 | ADR 0002 aceptado (agente de sondeo en sitio); registro de agentes, pasarela WebSocket y protocolo v1; alertas de agente desconectado; el frontend lee la conectividad desde la lista                          | CF-03                 |
| 2026-09-29 | Aplicación del agente y empaquetado para Windows y Linux; rol VENDOR; escalado de suscripción vencida a solo lectura y luego bloqueada; gestión de agentes en el frontend                                      | CF-07                 |
| 2026-09-30 | Servidor fuera de sitio sin contacto con dispositivos; ajustes desde el panel; gestión de usuarios; correcciones de permisos y pruebas e2e en el frontend                                                      | CF-07                 |
| 2026-10-01 | Actualización firmada del agente con reversión automática; imagen única y scripts de instalación por cliente; sondeo de radios detrás de un agente; parche de dependencias del frontend                        | CF-08                 |
| 2026-10-05 | Identidad: doble factor, bloqueo por intentos fallidos, sesión en cookie `httpOnly`, restablecimiento de contraseña por correo, invitaciones; límite global de peticiones; flujos equivalentes en el frontend  |                       |
| 2026-10-06 | Frontend: cierre de sesión al terminar un restablecimiento o activación; cabeceras de seguridad y exclusión del _mock_ en producción                                                                           | CF-08                 |

> El historial completo anterior al 21 de septiembre (585 commits en el backend desde el 3 de marzo de 2025, con versiones etiquetadas hasta `v0.5.0`) no se detalla aquí; sirve de contexto para el informe final.
