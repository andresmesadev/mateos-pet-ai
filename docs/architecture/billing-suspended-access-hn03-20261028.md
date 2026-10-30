# HN-03 — Gestión de suscripción durante la suspensión

**Fecha:** 28/10/2026. Corrección autorizada por Andrés como siguiente punto de
la [revisión del producto](../audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).

## Definición funcional y casos de uso

La suspensión conserva el bloqueo operativo existente. Una persona con
credencial vigente y autoridad administrativa actual debe poder iniciar sesión,
consultar el plan de su establecimiento y gestionar su suscripción. No concede
acceso a ventas, agenda, inventario, comunicaciones, historias o reportes.

- Sesión válida de administrador: acceso a la pantalla exacta de facturación;
  una ruta operativa suspendida conduce a esa pantalla después de revalidar.
- Personal sin autoridad administrativa: no accede a la gestión comercial.
- Credencial revocada, usuario inactivo o cambio de contraseña: no obtiene la
  excepción por conservar un rol antiguo en su sesión.
- Un administrador de establecimiento conserva exclusivamente su tenant. La
  selección de otro establecimiento corresponde solo al administrador global.
- Los fallos de validación del servidor se presentan como indisponibilidad,
  sin convertirlos en autorización ni en una sesión revocada.
- Se facilita el portal de suscripción de Stripe, sobre el customer guardado,
  para gestionar pagos pendientes y métodos de pago. Abrir ese portal no hace
  un cargo automáticamente ni activa por sí solo el establecimiento.
- Una suscripción cancelada o expirada puede iniciar nueva contratación; una
  existente no terminal debe gestionarse, evitando crear otra por reactivación.

## Arquitectura técnica

Se reutiliza la revalidación privada de Staff, independiente de la habilitación
comercial. Un adaptador compartido del servidor comprueba la autoridad actual
y resuelve el tenant desde la sesión. Página, protección de rutas y proxy de
facturación comparten esa comprobación. El rol del navegador y un tenant enviado
por una cuenta ordinaria no son autoridad.

El contenedor de facturación se separa del proveedor de acceso operativo y
sus refrescos. Incluye identidad del software y cierre de sesión; no monta
widgets operativos. La página vuelve a autorizarse en servidor y todas las
acciones pasan por el proxy administrativo autenticado.

El portal usa el servicio Stripe existente y el customer persistido para el
tenant resuelto. La ruta solo acepta esa identidad resuelta por el adaptador;
no un customer ni una configuración de portal propuestos por el navegador.
Su URL de retorno se construye en el servidor Next.js. El acceso vuelve a
habilitarse únicamente por las confirmaciones de suscripción existentes.

Esta es una excepción limitada para gestionar la habilitación comercial ya
existente, no un período de gracia. La protección de `/api/dashboard` conserva
su rechazo a establecimientos inactivos y WhatsApp conserva su suspensión.

## Persistencia y esquema físico

Sin schema, migraciones o modelos nuevos. Se reutilizan las credenciales,
versiones de sesión, rol/permisos actuales y campos de suscripción del tenant.
No se reactiva un establecimiento al entrar a la página, iniciar sesión o abrir
el portal. Los borradores operativos no se eliminan automáticamente por un 402.

## Validación y límites

Pruebas con dos establecimientos ficticios, administrador y personal sin permiso,
credencial revocada y cambio de rol, fallo transitorio, rutas operativas aún
bloqueadas y autenticación de página/API. Comprobar que el contenedor comercial
no monta el proveedor operativo. Probar el portal con Stripe simulado, customer
resuelto en servidor y ausencia de escrituras de activación.

Mantener el comportamiento previo de acceso de negocios activos y el bloqueo
operativo por suspensión. El registro de retorno de Checkout no constituye
confirmación de pago: el aviso debe reflejar el estado consultado en servidor.
No se habilita ni se modifica una cuenta real de Stripe o un establecimiento
durante estas comprobaciones. La configuración real del portal corresponde
al operador antes de ofrecerlo comercialmente.

## Resultado local — 28/10/2026

HN-03 corregido en el candidato 2.58.3, sin publicar. La página comercial,
la protección de páginas y el proxy comparten la revalidación administrativa.
El inicio de sesión de Staff admite administradores de un negocio suspendido,
incluidos profesionales con el permiso administrativo actual. No habilita el
negocio ni permite entrar a sus rutas operativas.

La suspensión detectada durante una sesión oculta el contenido operativo,
detiene su consulta periódica y conduce al recorrido comercial, que vuelve a
autorizar al usuario en servidor. No descarta borradores por esa suspensión.
La pantalla comercial no monta el proveedor, búsqueda ni barra operativos y
ofrece un cierre de sesión explícito. El administrador global necesita un
tenant seleccionado; no se elige un establecimiento implícitamente.

El portal recibe el customer persistido. Las URLs de retorno de portal y
Checkout se construyen en Next.js y conservan el tenant seleccionado por el
administrador global. Las cuentas ordinarias no pueden seleccionar otro tenant.
Una suscripción no terminal bloquea un nuevo Checkout con 409; una terminal
permite volver a contratar, incluido el mismo plan. Un evento tardío del contrato
anterior no sustituye una suscripción vigente distinta; su cancelación filtra
por identificador de suscripción antes de suspender. Esto no certifica el orden
arbitrario de eventos de estado de una misma suscripción ni la exclusión de
Checkouts concurrentes iniciados antes de persistir su primera suscripción.

Comprobaciones con identidades ficticias y proveedores simulados:

```text
Backend Jest: 225 suites passed; 1982 tests passed; 0 failed.
Node scripts: 36 files; 237 tests passed; 0 failed.
Frontend lint: exit 0.
Next.js build: exit 0; TypeScript correcto; 34 páginas generadas.
Documentación: 459 documentos; 1409 enlaces comprobados; 0 rotos.
git diff --check: exit 0.
```

Las pruebas incluyen credenciales/Staff inactivos, contraseña incorrecta,
versión de sesión revocada, permisos cambiados, aislamiento entre tenants,
indisponibilidad del backend, portal sin configuración, rechazo de URLs no
seguras y confirmación pendiente. El parámetro `success=1` no declara un pago
ni activa un negocio. Los errores de consulta ofrecen reintento sin mostrar
un estado comercial como confirmado.

No se modificaron schema, datos reales, credenciales de proveedores ni VPS.
El portal real y los planes requieren configuración y validación comercial
del operador antes de ofrecerlos a clientes externos.
