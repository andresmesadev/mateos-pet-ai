# Dashboard local: error 503 resuelto

Fecha: 5 de octubre de 2026.

## Causa comprobada

El frontend estaba activo en el puerto 3001, pero no había ningún backend escuchando en el puerto 3000. El monitor de desarrollo seguía abierto sin un proceso servidor activo. El proxy devolvía 503 al consultar `/api/dashboard/access`, por lo que el dashboard no podía cargar sus permisos.

No se conservó el error anterior del proceso backend; no se atribuye su detención a una excepción específica sin evidencia.

## Resolución

Se inició el backend, se comprobó que la configuración apunta a PostgreSQL local `127.0.0.1:5433/mateos_dev` y se reinició el monitor de desarrollo. Se dejó el backend ejecutándose con `npm run dev`, con acceso a las integraciones configuradas. No se modificó el código del aplicativo ni las credenciales.

## Evidencia

```text
Servidor iniciado {"port":"3000","env":"development"}
GET http://localhost:3000/api/health
HTTP=200 database=ok openai=ok worker=ok
```

El navegador volvió a cargar la navegación, permisos y la página de Seguimiento de clientes. La comprobación de salud incluye PostgreSQL, OpenAI y el worker de mensajes.

## Acceso y próximos arranques

- Frontend: http://localhost:3001/dashboard
- Backend: http://localhost:3000
- Base local: Docker, puerto 5433.

Docker activo no reemplaza al proceso backend: ambos deben estar funcionando. Para arrancar manualmente, usar `npm run dev` dentro de `backend/` y `npm run dev -- -p 3001` dentro de `frontend/`, conservando ambas terminales abiertas.

No hubo cambio de código que requiera repetir lint o tests. La verificación de esta incidencia fue el arranque real, el endpoint de salud y la recarga autenticada en el navegador. Sin commit ni despliegue.
