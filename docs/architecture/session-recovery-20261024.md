# Recuperar acceso tras cambiar contraseña

24/10/2026. Incidente comunicado por el responsable: sesión de Lina abierta
antes de cambiar su contraseña, bloqueada con texto sin menú ni cierre de sesión.

1. Función: conservar la revocación y ofrecer una salida visible para entrar
   con la contraseña nueva. Un fallo de datos temporal permite reintentar.
2. Casos: acceso a Dashboard/Print con sesión revocada (401/403), caída temporal
   (5xx/red), revocación detectada mientras la aplicación está montada y fallo
   del cierre interactivo. No se cambia contraseña ni se reactiva credencial.
3. Arquitectura: pantalla pública sin datos privados /session-recovery, fuera
   del gate que bloquea Dashboard/Print. Proxy redirige allí en vez de devolver
   texto. Botón usa el signOut de Auth.js existente, con CSRF y destino fijo
   /login; formulario GET de respaldo a la confirmación oficial /api/auth/signout. La
   pantalla de error del provider ofrece las mismas acciones.
4. Persistencia: ninguna nueva. Cerrar limpia workspace y borradores temporales
   como el cierre habitual. Las operaciones de POS inciertas conservan su clave
   durable y su aislamiento por cuenta. No borrar cookies manualmente, omitir
   autorización ni permitir el token revocado.
5. Esquema/validación: sin migración. Probar 401/403, 5xx/red, permisos normales,
   ausencia de sesión, políticas POST de páginas, no bucle y botones de salida;
   lint y build antes de declarar preparado. No operar la cuenta de Lina ni
   modificar datos del centro para verificar.

Decisiones diferidas: no se cambia el mecanismo JWT/sessionVersion ni se
automatiza el cierre por caídas de red. El usuario conserva una acción explícita.

## Verificación y salida inmediata

- El middleware real rechaza con 403 un sessionVersion anterior o una credencial
  desactivada; el proxy convertía ese rechazo a una respuesta de texto 503, sin
  cargar el sidebar. Ahora conduce a recuperación pública sin aceptar la sesión.
- Se comprobó mediante GET público que la confirmación ya desplegada
  `https://app.nexoweb.co/api/auth/signout?callbackUrl=%2Flogin` responde **200**
  y contiene formulario CSRF y botón Sign out. No se hizo POST ni se cerró sesión
  alguna para ensayar. El responsable puede abrirla en el navegador afectado,
  confirmar Sign out y volver a entrar con la contraseña actual.
- `node --test scripts/session-recovery.test.cjs scripts/page-request-policy.test.cjs scripts/pos-draft-history.test.cjs`:
  **25 tests, 25 pass, 0 fail**. Revocación 401/403, recuperación pública, caída
  temporal, permisos normales, invitado, bloqueo POST, cierre Auth.js, fallo de
  storage/cierre y conservación del POS incierto.
- Conjunto de helpers no PostgreSQL: **197 tests, 197 pass, 0 fail**.
- `npm run lint`: `eslint`, salida 0. `npm run build`: `Compiled successfully`,
  TypeScript correcto, `Generating static pages (33/33)`, salida 0.
- Sin cambios de backend, credenciales, datos del centro ni cookies manuales.
  Revisión visual en navegador pendiente por estar deshabilitado en esta sesión.
  Publicada en 2.58.0 el 24/10 a las 16:20 Colombia: recuperación pública GET 200,
  credencial revocada 403, artefactos compilados comprobados. No se cerró sesión
  alguna para ensayar. [Certificación](../history/RELEASE_2_58_0_VPS_20261024.md).
