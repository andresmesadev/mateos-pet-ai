# Revisión previa a publicación — 2026-10-05

## Alcance y resultado

Revisión del árbol de trabajo pendiente de Inventario y Punto de venta: backend,
frontend, migraciones, permisos, historial paginado, reportes, dependencias e
imágenes de producción. Versión del backend: **2.42.0**.

**Resultado: preparado para el paso de publicación, sin bloqueos detectados en
las comprobaciones realizadas.** Esta revisión no crea commit, tag ni push y no
despliega a la VPS. La aplicación de migraciones en producción y la comprobación
posterior del sitio pertenecen al despliegue pendiente.

## Hallazgos corregidos

1. La auditoría del frontend reportó seis alertas altas y dos moderadas en
   dependencias de producción. El aplicativo solo utilizaba el CSS del paquete
   CLI `shadcn`: sus utilidades se conservaron en `frontend/app/shadcn-utilities.css`,
   con la licencia MIT original, y se retiró la dependencia CLI. Se fijó además
   `uuid` compatible de la serie 11 para ExcelJS; su uso de `v4` continúa
   funcionando. No se hizo un downgrade forzado de ExcelJS ni de componentes.
2. El Dockerfile del frontend conservaba herramientas de desarrollo en la imagen
   final. Ahora ejecuta `npm prune --omit=dev --ignore-scripts` después del build.
   Se verificó que Next.js arranca y sirve login y CSS después de esa limpieza.
3. Persistían textos «Egresos» en Caja diaria, Reportes, impresión y Excel. Se
   unificaron como **Gastos**; los identificadores internos y enlaces `tab=egreso`
   conservan el contrato existente.
4. GitHub CI ahora ejecuta los tests de helpers del dashboard/POS y compila el
   frontend, además del lint, las pruebas de backend y la comprobación de
   migraciones que ya tenía.
5. `verify-inventory-local.cjs --fresh-migrations` permite comprobar la cadena
   completa desde una base local temporal vacía, sin depender del esquema ya
   instalado en `mateos_dev`.

## Evidencia ejecutada

| Comprobación | Resultado real |
|---|---|
| Backend, `node node_modules/jest/bin/jest.js --runInBand --silent --json` desde `backend/` | `exit: 0`, `total: 1271`, `failed: 0`, `suites: 161`. |
| Helpers, `node --test scripts/*.test.cjs` | `tests 64`, `pass 64`, `fail 0`, salida 0. Incluye lectura real del Excel exportado. |
| Frontend, `npm run lint` | Salida 0; ESLint sin diagnósticos. |
| Frontend Windows, `npm run build -- --webpack` | Salida 0; compilación, TypeScript y 29 páginas generadas correctamente. |
| `node scripts/verify-inventory-local.cjs` | 34 comprobaciones aprobadas en PostgreSQL real, 0 fallos. |
| `node scripts/verify-inventory-local.cjs --fresh-migrations` | `prisma validate`, `migrate deploy` y `migrate diff --exit-code`: salida 0; después las mismas 34 comprobaciones aprobadas. |
| Auditoría, `npm audit --omit=dev --json` en raíz, backend y frontend | Cada proyecto: salida 0; `info=0`, `low=0`, `moderate=0`, `high=0`, `critical=0`. |
| Imagen frontend, `docker build --progress=plain -t mateos-frontend-review:20261005 frontend` | Salida 0; build con Turbopack en Node 24/Linux; limpieza final: `found 0 vulnerabilities`. |
| Arranque de imagen frontend con `verify-frontend-image.cjs` montado de solo lectura | Login y CSS HTTP 200; POS anónimo redirige a login; TypeScript y CLI shadcn ausentes. Contenedor temporal eliminado. |
| Imagen backend, `docker build --progress=plain -f backend/Dockerfile -t mateos-backend-review:20261005 .` | Salida 0; Prisma Client 7.10.0 generado en Linux. |
| Carga del backend en contenedor temporal | Inventario carga; los cinco modelos de Inventario existen en Prisma; CLI de Prisma ausente del runtime; versión 2.42.0. |
| Sintaxis JS/CJS/MJS de archivos pendientes | 52 archivos comprobados inicialmente con Node `--check`, sin errores; el nuevo verificador Docker también ejecutado correctamente. |
| Scripts operativos con Git Bash `bash -n` | Seis scripts de backup, restauración, instalación, deploy, Prisma y preflight: salida 0. |
| `git diff --check` | Salida 0, sin errores de espacios. |
| Salud local `GET http://localhost:3000/api/health` | `status=ok`, `version=2.42.0`, coherente con package.json, lock y documentación del entregable. |

Las comprobaciones de PostgreSQL incluyen venta de la última unidad en
concurrencia, rollback financiero y físico, repetición idempotente, cambios de
precio, lotes vencidos, FEFO, permisos revocados, aislamiento por establecimiento,
conteos obsoletos, correcciones acumulativas, devoluciones y evidencia inmutable.

El barrido completo del frontend confirmó cero llamadas `apiUrl` desde
componentes cliente autenticados; el onboarding público conserva su excepción.
Se verificaron referencias SQL parametrizadas y el único adaptador de envío
WhatsApp. No aparecen archivos `.env` ni claves privadas entre los archivos
pendientes. Backend package y lock coinciden en 2.42.0.

## Condiciones de la comprobación

- Una ejecución inicial de tests en Windows terminó sin resumen; la ejecución
  posterior explícita con Node produjo el resultado completo aprobado indicado
  arriba. No se tomó el código de salida de esa ejecución inicial como evidencia
  de un fallo funcional corregido.
- El driver `pg` 8 emitió su advertencia de consulta concurrente durante las
  pruebas de carreras; las aserciones y transacciones pasaron. No se cambió a
  `pg` 9 como parte de esta revisión.
- Las imágenes se compilaron sin secretos reales. El aviso de secreto interno
  ausente durante el build no se ocultó; el arranque temporal utiliza valores
  ficticios y comprueba solo acceso anónimo. Los secretos reales deben seguir
  llegando mediante la configuración privada del despliegue.
- La auditoría certificada es la de dependencias **de producción**. Las
  herramientas de desarrollo pueden emitir alertas durante la instalación del
  build; se retiran del runtime final de ambas imágenes.
- Las pruebas nuevas de migración utilizaron bases temporales. Se retiró una
  base vacía e inactiva dejada por una ejecución interrumpida, tras verificar que
  no tenía tenants ni conexiones. No se modificaron datos de `mateos_dev` ni de
  la VPS.
- La revisión automatizada actual complementa los recorridos de navegador
  documentados previamente en `POS_INVENTORY_UX_VERIFICATION.md` y
  `POS_NAMES_PAGINATION_VERIFICATION_20261003.md`; no presenta esos recorridos
  anteriores como repetidos hoy.

Referencia del hallazgo de `braces`: [GitHub Advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
