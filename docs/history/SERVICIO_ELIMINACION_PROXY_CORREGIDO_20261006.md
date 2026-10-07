# Corrección de la eliminación desde el frontend — 2026-10-06

## Causa y cambio

El navegador enviaba `{ confirmName }`, pero el proxy autenticado descartaba el cuerpo de todas las solicitudes DELETE. El backend recibía el campo vacío y devolvía «Escribe el nombre del servicio para confirmar la eliminación».

El proxy ahora conserva el cuerpo de DELETE y sigue excluyéndolo de GET/HEAD. Autenticación, selección del establecimiento y protección de referencias no cambian.

La comprobación anterior alcanzó el formulario y el backend por separado; no detectó la pérdida del cuerpo entre ambos. La regresión ahora ejecuta el handler real de Next con una identidad temporal de prueba y un backend Express real sobre PostgreSQL local.

## Evidencia

`node --test scripts/service-catalog-postgres.test.cjs` — exit 0:

```text
PASS: proxy Next real → Express → PostgreSQL: DELETE conserva confirmName y elimina; validación, permisos, aislamiento, tarifas, historia y concurrencia protegidos.
✔ catálogo real: editar precio base, conservar tarifa por mascota e historia, retirar y reactivar (939.9956ms)
ℹ pass 1
ℹ fail 0
```

También se comprobó retiro mediante DELETE sin cuerpo, rechazo de confirmación incorrecta y eliminación con nombre que incluye «Baño». Los establecimientos de prueba se limpiaron al terminar.

ESLint frontend completo: exit 0, sin diagnósticos. `git diff --check`: exit 0, advertencias LF/CRLF únicamente.

Lectura del servicio real «Baño antipulgas»: retirado, 0 citas, 0 reglas de precio, 0 vínculos con el equipo. No se eliminó el servicio real durante las pruebas. El usuario puede volver a confirmar desde el formulario; el servidor de desarrollo recarga automáticamente el cambio del proxy.

Corrección local; sin commit, push ni despliegue en esta tarea.
