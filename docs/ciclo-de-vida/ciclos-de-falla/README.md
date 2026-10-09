# Ciclos de falla

Cada documento de esta carpeta reconstruye un ciclo completo de corrección: desde el síntoma hasta la regla, el código y la prueba que lo cierran. Se elaboraron el 2026-10-08 a partir del historial de Git; las fechas son las de los commits.

## Método

1. **Selección.** Se revisaron los 148 commits entre el 2026-09-21 y el 2026-10-06 en ambos repositorios. Se eligieron los cambios que corrigen un comportamiento defectuoso y que dejan evidencia suficiente (mensaje con causa raíz, prueba, regla actualizada). Quedan fuera del conjunto las funcionalidades nuevas.
2. **Evidencia.** Para cada ciclo se leyeron el mensaje completo del commit, los archivos modificados, el diff y la regla de negocio o documento de API asociado.
3. **Marcado de lo desconocido.** Lo que el historial no dice se marca `[CONFIRMAR]`.

## Recorrido de cada ciclo

Se sigue el proceso de mantenimiento del software (ISO/IEC 14764):

| Etapa                   | Pregunta que responde                      |
| ----------------------- | ------------------------------------------ |
| Identificación          | ¿Qué falló y cómo se supo?                 |
| Análisis                | ¿Cuál fue la causa raíz?                   |
| Diseño de la corrección | ¿Qué decisión se tomó y qué se descartó?   |
| Implementación          | ¿Qué archivos y commits la materializan?   |
| Pruebas                 | ¿Qué pruebas la verifican? ¿Cuáles faltan? |
| Documentación           | ¿Qué regla o documento se actualizó?       |
| Entrega                 | ¿Cuándo se liberó y en qué repositorio?    |

## Índice

| ID    | Documento                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------- |
| CF-01 | [Sondeo manual y tiempo máximo del proxy](CF-01-sondeo-manual-excede-proxy.md)                     |
| CF-02 | [Sondeo rechazado que respondía 500](CF-02-sondeo-rechazado-respondia-500.md)                      |
| CF-03 | [Filtro de conectividad que perdía dispositivos](CF-03-filtro-conectividad-pierde-dispositivos.md) |
| CF-04 | [Pruebas desactivadas y suites rotas](CF-04-pruebas-desactivadas-y-suites-rotas.md)                |
| CF-05 | [Cableado del contenedor de dependencias](CF-05-cableado-di-no-compilaba.md)                       |
| CF-06 | [Alerta de caída con fecha equivocada](CF-06-alerta-caida-fecha-equivocada.md)                     |
| CF-07 | [Rol VENDOR y permisos en la interfaz](CF-07-rol-vendor-y-permisos-en-interfaz.md)                 |
| CF-08 | [Vulnerabilidades y cabeceras de seguridad](CF-08-vulnerabilidades-y-cabeceras-de-seguridad.md)    |

## Candidatos para ampliar

Cambios del mismo período que podrían documentarse si hace falta más material: el aviso inmediato al backend cuando el agente rechaza una actualización (`49578ad`, backend), el cierre de la sesión abierta al terminar un restablecimiento o activación de contraseña (`b226e5b`, frontend) y el anclaje de las listas desplegables que se abren hacia arriba (`7c1b3ad`, frontend).
