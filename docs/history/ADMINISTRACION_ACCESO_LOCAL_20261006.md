# Administración — acceso local restablecido

Fecha: 2026-10-06. Incidencia reportada: Administración mostraba “No se pudo cargar la administración” en `http://localhost:3001/dashboard/settings`.

## Diagnóstico y corrección

El backend estaba conectado y respondía, pero `GET /api/dashboard/tenant/profile` devolvía HTTP 500. Los endpoints de servicios, acceso y salud funcionaban. El secreto interno de frontend y backend coincidía; no se modificaron credenciales.

Una consulta en un proceso nuevo con el cliente Prisma actual leyó correctamente `Tenant.contactPhone` en PostgreSQL local. El backend en ejecución conservaba el cliente cargado antes de la actualización. Se notificó a su `nodemon` un cambio de fecha del archivo de rutas, sin modificar el contenido, para recargar el proceso.

Después de la recarga, el perfil volvió a responder HTTP 200 y Administración cargó correctamente. No fue necesario modificar la base de datos, permisos ni la configuración de áreas.

## Evidencia

```text
Antes:
/api/health status 200
/api/dashboard/tenant/profile status 500 {"error":"Internal server error"}
/api/dashboard/services status 200
/api/dashboard/access status 200

Consulta con Prisma actual:
Prisma actual: contactPhone readable=true
exit_code=0

Después de recargar el backend:
/api/dashboard/tenant/profile status=200 contactPhoneField=true
/api/dashboard/services status=200
/api/health status=200
```

En el navegador local con la sesión administradora existente se comprobó:

- Datos del negocio mostró nombre, teléfono de contacto, correo y dirección, sin el aviso de carga fallida.
- Áreas del negocio abrió correctamente con Veterinaria, Peluquería y Pet shop activas.
- La URL quedó en `/dashboard/settings?tab=areas`, con la pestaña correspondiente seleccionada.
- No se guardó ningún cambio de negocio durante esta comprobación.

No hubo cambios de código funcional; se verificó la recuperación del proceso mediante HTTP y navegador. Las pruebas de implementación, lint y build del bloque anterior constan en `ADMINISTRACION_AREAS_20261006.md`.

## Para continuar

El backend permanece en puerto **3000** y el frontend en **3001**. Recarga tu pestaña con **Ctrl + F5** o abre [Administración](http://localhost:3001/dashboard/settings).

Tras regenerar Prisma por un cambio de esquema, un backend ya iniciado también debe recargarse para utilizar el nuevo cliente. La migración y regeneración en disco no sustituyen los módulos que un proceso mantiene en memoria.
