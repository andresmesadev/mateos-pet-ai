# Continuidad de sesión ante saturación temporal — 26/10/2026

## Incidente y evidencia

El responsable informa que Lina entra con su contraseña nueva en Microsoft Edge,
pero el dashboard vuelve a ofrecer reconectar/cerrar sesión. Revisión de solo
lectura: cuenta y credencial activas, versión de sesión 2 sin nuevos cambios
desde el 24/10 a las 14:06 Colombia. Cinco consultas con la identidad vigente
devuelven 200 (6–85 ms); la versión anterior sigue devolviendo 403.

En registros de las últimas 48 horas se encontraron dos respuestas 429 a
`/api/proxy/dashboard/access` desde Edge y peticiones repetidas de recuperación
con `reason=unavailable`. El resumen excluye IP, cookies, contraseñas y correo.
No hubo errores JWTSessionError en los registros runtime inspeccionados.
Sentry no expuso proyectos accesibles para esta investigación. No se accedió al
navegador del equipo de Lina ni se atribuye el fallo a una configuración de Edge.

## Causa localizada

Navegación/prefetch del servidor y revalidación del cliente usan el mismo
presupuesto de 60 solicitudes por minuto y operador que el resto del dashboard.
Agotar operaciones puede impedir consultar los permisos de una sesión válida.
Además, el provider retiraba el workspace ante cualquier error de fetch/5xx/429,
convirtiendo una saturación temporal en una pantalla que sugiere cerrar sesión.
Las revalidaciones por foco, reconexión y temporizador podían solaparse.

## Corrección del adaptador existente

- Dos presupuestos acotados por identidad y establecimiento: operaciones 60/min
  y comprobaciones GET/HEAD exactas de `/access` 60/min. Ambos pasan primero por
  autenticación. Ingreso global 300/min interno y 60/min sin token correcto,
  suspensión y revocación permanecen. No hay exención ilimitada.
- Revalidación single-flight, cancelación al cambiar de scope/desmontar, timeout
  de 15 segundos, enfriamiento corto de foco y respeto de Retry-After en 429.
  El proxy conserva Retry-After y marca permisos no-store.
- Un fallo temporal conserva únicamente el manifiesto ya comprobado del mismo
  establecimiento y mantiene montados formularios/borradores. Muestra un aviso
  discreto y reintenta automáticamente. Cada operación mantiene su autorización
  independiente en backend; no se otorgan capacidades nuevas.
- Sin manifiesto previo no se renderiza información protegida. 401/403 retiran
  el workspace y llevan al cierre oficial de sesión; 402 y otras denegaciones
  definitivas también bloquean el contenido. Cambiar de establecimiento retira
  inmediatamente el manifiesto anterior e ignora respuestas atrasadas.

Es mantenimiento de los adaptadores de acceso ya existentes; no incorpora una
entidad, regla de negocio, fase ni migración. No altera credenciales, duración
JWT, versión de sesión, cookies ni permisos de Lina. La protección de contraseña
cambiada continúa vigente. No requiere volver a cambiarla.

## Verificación

Pruebas específicas iniciales: 23 auxiliares y nueve de capacidad HTTP aprobadas.
Incluyen preservación del workspace en 429/503/red intermitente, Retry-After,
foco simultáneo, reconexión, primer acceso sin permiso comprobado, cambio de
tenant, revocación y suspensión; la prueba HTTP agota operaciones y comprueba
permisos independientes sin restablecer el límite de operaciones.

Verificación final local:

- Auxiliares no PostgreSQL: **207 tests, 207 pass, 0 fail**. El archivo nuevo
  aporta diez casos, incluido timeout de una comprobación sin perder el formulario.
- Capacidad/autenticación HTTP: **1 suite, 9 tests aprobados**, incluidos los
  presupuestos independientes, revocación, suspensión e ingreso global.
- Lint: salida 0. Build: `Compiled successfully`, TypeScript correcto,
  `Generating static pages (33/33)`, salida 0. La descarga de fuentes públicas
  falló con la red aislada; la compilación con acceso autorizado terminó bien.
- La regresión completa de 220 suites sufrió cierre nativo de Windows
  `-1073740791`, sin producir el informe JSON de resultados, tanto en ejecución
  normal como silenciosa. Un grupo de cinco suites de acceso también terminó
  con ese cierre nativo; la suite aislada de nueve casos HTTP sí pasó. No se
  declara aprobada la ejecución completa ni se transforma en un fallo de
  test inexistente. CI completo debe aprobar antes de un eventual despliegue.
- Diff sin errores de espacios. Sin comprobación visual en el navegador de Lina.

Publicada como **2.58.1 el 26/10 a las 14:57 Colombia**, tras autorización expresa
del responsable. El CI completo aprobó 220 suites/1.866 tests, lint y las tres
integraciones PostgreSQL. Producción confirma sesión vigente 5/5 HTTP 200 y
versión anterior 403; credenciales, stock e histórico financiero conservan sus
huellas. [Certificación y límites](../history/RELEASE_2_58_1_VPS_20261026.md).
Durante diagnóstico y publicación no se cambiaron contraseña ni datos operativos.
