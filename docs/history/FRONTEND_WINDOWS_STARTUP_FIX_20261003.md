# Corrección del arranque del frontend en Windows

Fecha: 2026-10-03.

## Causa y corrección

Windows Application Control rechazó la carga de `next-swc.win32-x64-msvc.node` con `ERR_DLOPEN_FAILED`. Además, la configuración TypeScript utilizaba `__dirname`, que no existe en el ámbito de módulos ES donde se estaba evaluando.

- Se sustituyó `frontend/next.config.ts` por `frontend/next.config.mjs`, con la raíz calculada mediante `dirname(fileURLToPath(import.meta.url))`.
- `npm run dev` utiliza `next dev --webpack`, compatible con el respaldo WebAssembly de Next.js cuando el compilador nativo está bloqueado.
- Para verificar la compilación local se utilizó `npm run build -- --webpack`. El script de compilación de producción conserva `next build`.
- Se conservaron los cambios del POS que muestran servicios y productos únicamente al buscar o abrir sus respectivos botones de catálogo.

No se modificaron las políticas de seguridad de Windows.

## Evidencia

Comandos ejecutados en el equipo local:

```text
npm run lint
> eslint
Código de salida: 0

node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs
tests 18
pass 18
fail 0
Código de salida: 0

npm run build -- --webpack
Compiled successfully in 26.8s
Finished TypeScript in 5.2s
Generating static pages using 11 workers (29/29)
Código de salida: 0

GET http://localhost:3000/api/health
HTTP 200
{"status":"ok","version":"2.42.0"}

GET http://localhost:3001/login
HTTP 200
```

El navegador mostró el formulario de inicio de sesión al abrir `/dashboard/pos?tab=venta`. Esta comprobación de arranque no incluyó un nuevo recorrido autenticado del POS; la verificación de sus cambios se registra por separado en `POS_INVENTORY_UX_VERIFICATION.md`.

La advertencia del compilador nativo puede seguir apareciendo; las comprobaciones anteriores finalizaron correctamente utilizando WebAssembly y Webpack.
