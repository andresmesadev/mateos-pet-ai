# Registro de cuenta con preparación parcial — HN-07

**Fecha:** 29/10/2026. **Estado:** corrección comprobada y cerrada localmente;
publicación del lote pendiente.

## Contrato y alcance

La ruta de registro ya devuelve HTTP 201 cuando crea el establecimiento y su
administrador, con `provisioning: ready | pending`. Una preparación parcial de
los empleados digitales no revierte la cuenta. La interfaz debe distinguir
esa preparación del inicio de sesión y de la disponibilidad del dashboard.
Corregir la omisión no implica activar WhatsApp ni asignar un cupo de IA.

- `ready` e inicio de sesión correcto: conservar la bienvenida existente.
- `pending`: mostrar que la cuenta está creada, que la preparación de sus
  asistentes necesita revisión y cómo solicitarla. Se puede entrar al dashboard
  sin esperar esa preparación; no se anuncia que WhatsApp o IA estén activos.
- Estado ausente/desconocido: informar que no se pudo comprobar la preparación,
  sin convertirlo silenciosamente en éxito completo ni repetir el registro.
- Error de inicio de sesión después de HTTP 201: conservar el resultado de la
  creación, limpiar la contraseña del formulario y ofrecer iniciar sesión.
  Si había preparación pendiente, ese aviso permanece visible.
- Un cuerpo inválido con HTTP de éxito tampoco habilita un segundo registro.
  La recuperación se hace iniciando sesión con la cuenta ya creada.

## Diseño técnico y persistencia

Corrección del adaptador público de registro, sobre `Tenant`, Staff y Empleados
Digitales ya existentes. No es un nuevo entregable de Fase 2 y no requiere
entidades, casos de uso, migraciones o reglas de acceso adicionales.

El formulario conserva el resultado de preparación y de inicio de sesión por
separado. Una referencia de creación confirmada bloquea nuevos POST incluso
antes del siguiente render. La respuesta se interpreta conservadoramente y
la redirección automática a la bienvenida solo ocurre con `ready` explícito.
Las rutas de destino son constantes internas, nunca URLs de la respuesta.

Para solicitar revisión se ofrece el correo de soporte de Huella Nex creado
por Andrés, `huellanex@nexoweb.co`. El enlace abre el cliente de correo del
usuario; no envía nada automáticamente. Incluye únicamente el identificador
del negocio y el tipo de revisión, sin contraseña, token ni datos personales
de clientes. También muestra el identificador para que pueda comunicarlo por
el canal de soporte acordado si no tiene un cliente de correo configurado.

## Resolución operativa

El equipo técnico comprueba el establecimiento que corresponde a la solicitud
y reutiliza `provisionDefaultDigitalEmployees(tenantId)` para **ese identificador**.
La función existente conserva los empleados ya creados e informa el resultado
por especialización. No se ejecuta el seed global sobre todos los negocios para
resolver un alta parcial ni se pide al usuario volver a registrar su cuenta.
La recuperación se comprueba leyendo los empleados del mismo establecimiento;
conectar canales y habilitar cupos siguen siendo decisiones independientes.

## Validación y decisiones diferidas

Se comprobó el componente real con respuestas y autenticación simuladas:
`ready`, `pending`, desconocido, JSON inválido, fallo posterior de login,
doble envío, siete combinaciones de módulos y acción de soporte sin secretos.
Se comprobó además que el proxy público conserva `ready` y `pending` con HTTP
201 y `no-store`, sin reenviar cookies, tokens internos ni autorización.

Resultados reales del 29/10:

```text
Componente y proxy HN-07: 26 tests, 26 pass, 0 fail
Contrato backend onboarding: 1 suite passed, 26 tests passed, 0 failed
Flujos Node completos: 41 archivos, 284 tests, 284 pass, 0 fail
Frontend npm run lint: exit 0
Frontend tsc --noEmit --incremental false: exit 0
```

Las pruebas ejecutan los manejadores reales del formulario, con estado y
autenticación simulados. Incluyen doble submit antes del render posterior,
JSON inválido tras HTTP 201, estados ausentes/desconocidos, respuestas de login
fallidas o incompletas y las siete combinaciones de módulos. Comprueban el
destino interno, el aviso visible, la limpieza de contraseñas en el formulario
y que el enlace de correo no incluya credenciales ni datos de clientes.
No sustituyen una nueva comprobación visual móvil/escritorio ni una prueba de
alta en producción; esas acciones no se realizaron en este cierre.

El aviso describe el resultado de este intento de alta. No se crea una cola
de soporte, un reintento automático ni un estado persistente nuevo de
aprovisionamiento. Esas capacidades quedan fuera de esta corrección; el
dashboard no se bloquea ni se presenta este aviso como una certificación de
disponibilidad de los asistentes. No se crean cuentas reales durante las pruebas.

Versionado: corrección de presentación sin capacidad que requiera una versión
menor; el versionado del lote acumulado se revisará antes de publicarlo.
