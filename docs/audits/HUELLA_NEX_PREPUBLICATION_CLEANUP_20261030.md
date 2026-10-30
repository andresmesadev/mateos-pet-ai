# Huella Nex: barrido y limpieza previa a publicación

**Fecha:** 30/10/2026, Colombia. **Candidato:** 2.58.3.
**Alcance autorizado:** revisión y correcciones locales antes de commit, push y
despliegue. No se ejecutó ninguno de esos tres pasos ni se consultó/modificó la VPS.

## Resultado

Se revisaron archivos candidatos, exclusiones de Git/Docker, coherencia de
manifiestos/locks, dependencias y avisos actuales, rutas de integración y
autorización, migraciones aditivas, sintaxis y pruebas. El recorrido final local
queda favorable dentro de las comprobaciones descritas. No se certifica ausencia
absoluta de defectos, secretos o vulnerabilidades; no es una prueba de penetración.

El árbol reúne trabajo previo de producto, marca, proveedores, migraciones,
operación y documentos. Esos cambios no son residuos por estar sin commit.
Se conservaron los cambios del usuario, identificadores técnicos heredados,
datos locales, respaldos y evidencias; no se borraron en bloque directorios.

## Limpieza y correcciones

| Hallazgo | Acción |
| --- | --- |
| Adjuntos del chat aparecían como archivos nuevos publicables | Exclusión explícita de `.codex-remote-attachments/` en Git y contextos Docker. Permanecen locales. |
| Contextos Docker sin exclusiones expresas para cachés/temporales/copias | Se excluyen `.cache`, `.tmp`, respaldos, reportes de pruebas y cachés Python; se amplía la exclusión de `.env.*` en frontend. |
| Pruebas unitarias CI recibían una clave OpenAI real | Sustitución por una clave sintética; el recorrido usa proveedores simulados. No se elimina ni cambia el secreto guardado en GitHub. |
| Dependencias con parches compatibles disponibles | Prisma/cliente/adaptador 7.10.1 coherentes; Zod 4.6.7 y fast-uri 3.1.9 en lock. Se actualizaron dependencias transitivas resueltas por Prisma. |
| Prueba de proveedores dependía del puerto 55440, reservado por Windows | Puerto aleatorio de Docker limitado a loopback. El hijo exige puerto y referencia de la ejecución temporal, nombre/usuario de fixture y protocolo/host exactos. No acepta una URL externa para el arnés. |
| Prueba Python asumía `os.getloadavg`, ausente en Windows | Se simula esa lectura de Linux en la prueba; el muestreador de la VPS conserva su comportamiento. |
| Comentario de entorno afirmaba omitir el token en modo heredado | Se corrigió: `SINGLE_TENANT_ID` no omite el secreto interno ni los permisos; Staff conserva su tenant autenticado. |
| Faltaba un control reutilizable para publicación | `check-release-hygiene.cjs` revisa archivos privados/generados, patrones de credenciales, conflictos de merge y coherencia de versiones/locks. Solo informa ubicaciones, nunca los valores detectados. |
| Pruebas PostgreSQL comerciales no estaban conectadas al CI | Se agregó un job aislado con imagen fijada por digest, sin credenciales de proveedores, y control de higiene antes de instalar dependencias. |

El control de publicación cubre patrones conocidos; no reemplaza una revisión
humana. La ausencia de un patrón no acredita que cualquier otro secreto sea
inexistente. Las capturas y documentos privados siguen fuera del lote.

La revisión automática de seguridad rechazó el intento de borrar `__pycache__`
con motivo «blocked by policy». No se intentó otra vía de borrado. Esas cachés
se conservaron excluidas de Git/Docker. No afectan al resultado del producto.

## Dependencias al corte

`npm audit --omit=dev --json` en raíz, backend y frontend:

```text
root production:     total 0
backend production:  total 0
frontend production: total 0
```

Auditoría completa, incluyendo desarrollo:

- Raíz: cero avisos después de actualizar Prisma y fast-uri.
- Frontend: cero avisos después de actualizar Zod.
- Backend: cinco avisos de severidad baja propagados por la cadena de Jest,
  originados en `deepmerge` 4.3.1. Los registros del lock están marcados de
  desarrollo y el backend de producción instala con `--omit=dev`.

El [aviso de deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
no publica versión corregida al corte. `npm audit` propone retroceder Jest de
30 a 25; no se aplicó un downgrade incompatible ni `audit fix --force`.
Se conserva como pendiente de herramientas de desarrollo. No usar esas
herramientas con configuración no confiable.

Se contrastaron también los avisos de
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) y
[deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
Los avisos dependen de la base consultada y pueden cambiar; los resultados no
certifican el software ni el sistema operativo de la VPS.

## Evidencia real de validación local

| Verificación | Resultado |
| --- | --- |
| Suite backend, después de actualizar dependencias | 238 suites, 2.136 pruebas aprobadas, 0 fallos |
| Flujos Node, incluyendo guardas de publicación | 44 archivos, 295 pruebas aprobadas, 0 fallos |
| PostgreSQL de proveedores/cupos/concurrencia | 17 pruebas aprobadas, 0 fallos |
| Navegador + PostgreSQL: guía, tres nichos, visibilidad y soporte/salida | 34 comprobaciones aprobadas, 0 fallos |
| Navegador: revisión comercial general | 23 comprobaciones aprobadas, 0 fallos |
| Python: configuración y muestreador | 11 pruebas aprobadas |
| Next optimizado, TypeScript y ESLint | Correctos, sin diagnósticos de lint |
| Prisma generate/validate | Cliente 7.10.1 generado y esquema válido, sin conexión real |
| Migraciones desde base vacía y comparación con esquema | Aprobadas en los recorridos temporales |
| Sintaxis JS/CJS revisada | 118 archivos del inventario inicial sin errores; archivos nuevos comprobados por sus ejecuciones/pruebas |
| Bash de despliegue/respaldos y PowerShell de scripts | Sintaxis correcta |
| Workflow CI | YAML válido; nuevo job preparado, todavía no ejecutado en GitHub |
| Higiene de publicación y `git diff --check` | Sin incidencias en el alcance del control |

Los 34 controles combinados comprobaron también recuperación de cuenta,
exportación consistente y protegida por ámbito, rechazo de identidad/referencias
ajenas y conservación de cierres/stock. No se envió ninguna copia al exterior.
Las pruebas de proveedores usaron reservas concurrentes reales en PostgreSQL y
proveedores simulados, sin consumos reales.

Cada arnés eliminó únicamente su contenedor temporal identificado. El contenedor
de desarrollo existente permaneció operativo. No se ejecutó `docker prune`,
limpieza de volúmenes, restauración real, borrado de datos o reactivación de la
tarea de respaldo del computador.

## Qué falta al publicar

Este barrido no reemplaza preparar y revisar el lote concreto ni la ejecución
remota del CI. Las dos migraciones nuevas de proveedores siguen pendientes de
publicación; son aditivas y no aprovisionan credenciales o cupos reales. Antes
de aplicarlas corresponde el respaldo y procedimiento de despliegue vigentes.
No se construyeron aquí las imágenes completas de producción ni se ensayó un
despliegue sobre la VPS.

Se conserva 2.58.3 como candidato, sin tag oficial. Al publicar se debe mantener
coherencia entre versión, documentación y salud, ejecutar CI y comprobar la
aplicación después. WhatsApp/IA comercial, estabilidad vigente, recuperación
independiente y aceptación externa conservan sus condiciones; la limpieza no
los declara cerrados.
