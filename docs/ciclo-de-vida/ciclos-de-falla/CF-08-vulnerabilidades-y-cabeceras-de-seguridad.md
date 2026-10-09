# CF-08 — Vulnerabilidades en dependencias y cabeceras de seguridad

| Campo                                 | Valor                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Fechas de corrección                  | 2026-10-01 (dependencias) · 2026-10-06 (cabeceras y modo de simulación) |
| Commits (frontend)                    | `93aded1`, `2d73ed6`                                                    |
| Contexto                              | Seguridad de la aplicación web                                          |
| Tipo de mantenimiento (ISO/IEC 14764) | Preventivo + correctivo                                                 |
| Fecha de detección · quién · impacto  | `[CONFIRMAR]`                                                           |

## 1. Identificación

| Evento                                                                                                                            | Cómo se identificó                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Avisos de seguridad en dependencias (incluidos tres de ejecución remota de código en Next.js)                                     | Auditoría de dependencias con `npm audit`, según el commit `93aded1`                  |
| Pantallas de inicio de sesión y doble factor susceptibles de _clickjacking_; modo de simulación de la API accesible en producción | `[CONFIRMAR]` (el commit `2d73ed6` describe la corrección, no el origen del hallazgo) |

## 2. Análisis

### 2.1 Dependencias (`93aded1`)

| Paquete           | Versión         | Aviso                                                                                                                                                           |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`            | 16.3.1 → 16.3.8 | Tres avisos de ejecución remota de código: GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4, GHSA-vcvr-r3jv-pc5j                                                        |
| `sharp`           | 0.35.3 → 0.35.5 | Mencionado en el commit junto a `libheif`                                                                                                                       |
| `js-yaml`         | 4.3.1 → 4.3.2   | El commit agrupa estos cuatro paquetes con dos efectos: denegación de servicio y una copia que sigue enlaces simbólicos (no se asigna cada efecto a un paquete) |
| `brace-expansion` | 1.1.21 y 5.0.12 | Ídem                                                                                                                                                            |
| `@humanfs/node`   | 0.16.8          | Ídem                                                                                                                                                            |

Todas las actualizaciones quedan dentro de los rangos ya declarados en `package.json`.

### 2.2 Cabeceras y modo de simulación (`2d73ed6`)

| Riesgo (descripción del análisis)                                                                       | Corrección                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Otro sitio podía enmarcar el panel y capturar clics (_clickjacking_) en inicio de sesión y doble factor | `frame-ancestors 'none'` y `X-Frame-Options: DENY` en todas las páginas                                             |
| Sniffing de tipos, filtración de referencia y permisos amplios del navegador                            | `X-Content-Type-Options: nosniff`, `Referrer-Policy` de mismo origen, `Permissions-Policy` restringida y HSTS       |
| Se anunciaba la tecnología del servidor                                                                 | Se elimina `X-Powered-By`                                                                                           |
| La API simulada (`NEXT_PUBLIC_USE_MOCK`) **inicia sesión a cualquiera con cualquier contraseña**        | La variable se **ignora fuera del modo de desarrollo**, de modo que no puede llegar a una compilación de producción |

## 3. Diseño e implementación

- `93aded1`: `npm audit fix` sin cambiar `package.json`; solo cambia `package-lock.json` (189 inserciones, 175 eliminaciones).
- `2d73ed6`: `next.config.ts` (+22 líneas, cabeceras), `src/services/api.service.ts` (condición del modo de simulación) y `package-lock.json` (`source-map-js`).

## 4. Pruebas

| Commit    | Verificación informada                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `93aded1` | `npm audit` informa 0 vulnerabilidades; `tsc` y `lint` sin cambios; la compilación de producción tiene éxito; las pruebas e2e pasan contra ella |
| `2d73ed6` | El commit no modifica pruebas. `[CONFIRMAR]` cómo se comprobaron las cabeceras (por ejemplo, con las herramientas del navegador)                |

## 5. Documentación actualizada

Ninguna en el repositorio. `[CONFIRMAR]`

## 6. Trazabilidad

| Elemento                         | Evidencia                                              |
| -------------------------------- | ------------------------------------------------------ |
| Detección de dependencias        | `npm audit`; resultado en el mensaje de `93aded1`      |
| Cabeceras de seguridad           | `next.config.ts`                                       |
| Exclusión del modo de simulación | `src/services/api.service.ts`                          |
| Verificación                     | Compilación de producción y `npm run e2e` (Playwright) |

## 7. Lecciones y mejoras

- Las dependencias envejecen aunque el código no cambie; la auditoría debe ser periódica y no puntual.
- Un modo de simulación que autentica a cualquiera es una puerta trasera si llega a producción; la protección correcta es estructural (se ignora fuera de desarrollo) y no depender de que nadie lo active por error.
- _Observación del análisis_: el repositorio del frontend no tiene carpeta `.github`, por lo que no hay integración continua que ejecute auditoría, compilación y pruebas e2e; esas comprobaciones se hacen a mano.
- _Mejora propuesta_: un flujo de CI para el frontend con `npm audit --audit-level=high`, compilación de producción y Playwright, equivalente al `ci.yml` del backend.
