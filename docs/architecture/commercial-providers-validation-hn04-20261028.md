# HN-04 — conexiones por establecimiento y cupos de IA: validación local

Fecha: 28/10/2026. Candidato local 2.58.3. Base: [ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md),
[definición funcional](commercial-providers-functional-definition-20261028.md) y
[diseño técnico y físico](commercial-providers-technical-design-20261028.md).

## Resultado y alcance

La capacidad técnica está implementada y validada localmente. **HN-04 no queda
cerrado comercialmente:** no hay evidencia de aprobación de Meta como Tech
Provider, ni aceptación externa de Embedded Signup y facturación directa.
No se activó ninguna conexión, credencial, cupo, mensaje o cargo real.
No hubo commit, push, despliegue ni migración en la base operativa.

**Seguimiento 29/10:** se creó en Meta la app y portfolio Huella Nex, con correo
propio, y se confirmó su clasificación como proveedor de tecnología. No es una
aprobación: la verificación documental se dejó como solicitud pendiente por
decisión de Andrés. No se configuraron secretos nuevos en el backend ni se
conectó ningún número real mediante la nueva app. La medición de audio/contexto
del [ADR 034](../decisions/034-medicion-ia-duracion-y-contexto.md) y su
[presupuesto sintético](../research/AI_CREDIT_METERING_VALIDATION_20261029.md)
quedaron implementados y probados localmente. HN-04 comercial continúa abierto.

Huella Nex administra una credencial de WhatsApp cifrada por Tenant. La
autorización se verifica en servidor contra aplicación, permisos, vigencia y
acceso efectivo a cuenta/número. El reto OAuth es de un uso, tiene 10 minutos
de vigencia y está ligado al administrador, Tenant y revisión de conexión.
Los permisos administrativos se vuelven a comprobar después de la llamada a
Meta. La ruta no se obtiene de un número escrito en un formulario.

Cuenta y número son únicos y no se reasignan al desconectar. La desconexión
local borra el secreto, incrementa la revisión, invalida rutas privadas y deja
traza del actor. Renovar solo admite la misma cuenta/número; cambiar de número
requiere una revisión específica. No se revoca ni elimina una app remotamente
desde esta acción, ni se comparte una línea de crédito de Huella Nex.

Texto, plantillas, descargas de audio y mensajes privados usan la ruta del
Tenant. Los mensajes entrantes verifican WABA y número antes de encolar. Los
eventos de historia/coexistencia no se tratan como mensajes nuevos. Cada job
nuevo conserva identificadores y revisión, nunca el token; una ruta antigua o
un job sin snapshot en modo multilínea quedan para revisión, sin reenvío con
credenciales nuevas. El canal global heredado solo sirve a su Tenant asociado
y nunca sustituye una conexión comercial revocada o caducada.

El consumo de IA tiene cupo mensual por Tenant, contadores y reservas atómicas.
Cubre análisis, redacción, embeddings, transcripción e interpretación operativa.
Cada llamada reserva antes de invocar al proveedor y desactiva sus reintentos
ocultos. El resultado aceptado consume unidades una vez; un rechazo comprobado
las libera; un resultado incierto las conserva. Una reserva interrumpida por
crash se muestra para revisión tras 15 minutos, sin devolución automática.
La conciliación exige referencia de evidencia y autoridad técnica global.
No se guardan prompts, respuestas ni datos de clientes en el registro de uso.
La sonda técnica `models.list` no genera contenido y no consume cupo de Tenant.

Solo administración técnica global asigna cupos y concilia consumos. El
administrador vigente del negocio consulta su consumo y gestiona su conexión.
Agotar el cupo no cambia `Tenant.active` ni suspende agenda, POS o inventario;
se puede continuar manualmente. No se aplican cargos automáticos por excedentes.

La pantalla **Administración → WhatsApp e IA** usa proxy autenticado, comprueba
la sesión actual y protege las escrituras por origen. El SDK de Meta se carga
solo tras solicitar la conexión y usa una segunda acción explícita para abrir
su ventana. El navegador recibe IDs públicos y estado, nunca secretos.

## Evidencia reproducible

| Comprobación | Resultado observado |
| --- | --- |
| `npx prisma generate` | Cliente generado correctamente con Prisma 7.10.0. |
| Migraciones en PostgreSQL aislado | 68 migraciones aplicadas; las dos nuevas son aditivas, sin backfill. |
| `node --test backend/tests/postgres/commercial-providers.test.cjs` | 17 pruebas aprobadas; cero fallos (seguimiento 29/10). |
| Concurrencia PostgreSQL | Cupo 2, veinte reservas simultáneas: exactamente 2 aceptadas y 18 rechazadas; contadores consistentes. |
| Concurrencia ponderada de audio | Cupo 10, doce reservas simultáneas de audio de 61 s a peso 5: una aceptada, once rechazadas; seis liquidaciones repetidas descuentan solo 10. |
| Jest completo del backend | 233 suites, 2.086 pruebas aprobadas; cero fallos o pendientes (29/10). |
| Flujos Node y scripts locales | 39 archivos, 252 pruebas aprobadas; cero fallos (29/10). Incluyen WAV/Ogg Opus reales sintéticos, control de workers y presupuesto de créditos. |
| `npm run lint` en frontend | Estado 0; cero errores o advertencias. |
| TypeScript y compilación Next | Sin errores; `next build` generó las rutas de proxy y configuración de integraciones. |

En el seguimiento 29/10 se repitieron lint y TypeScript: ambos terminaron con
estado 0. La compilación Next de la tabla corresponde al corte anterior; no se
repite por los textos explicativos del medidor. La primera pasada de scripts
tuvo un `EPERM` de Windows al renombrar una carpeta de respaldo **sintética**;
la misma suite terminó sin fallos al ejecutarse con ese permiso, sin modificar
el script ni acceder a un respaldo real.

Las pruebas PostgreSQL exigen explícitamente host `127.0.0.1`, puerto `55440`,
base `huella_provider_check` y usuario `provider_test`. Usan tenants sintéticos
con IDs propios y credenciales de demostración, sin acceder a la base real.
No deshabilitan los triggers de auditoría: el estado de prueba se elimina al
retirar el contenedor con almacenamiento tmpfs y `--rm`.

Al terminar se verificaron nombre, etiqueta de propósito, puerto y tmpfs; se
detuvo únicamente `huella-provider-check-20261028-hn04` y la consulta posterior
por ese nombre exacto no devolvió ningún contenedor. No se alteraron los otros.

El seguimiento 29/10 usó `huella-metering-check-20261029`, con etiqueta
`huella.purpose=isolated-metering-tests`, el mismo puerto/base/usuario de prueba,
tmpfs y eliminación automática. Las 68 migraciones se aplicaron solo allí.
Se verificaron etiqueta, puerto y almacenamiento; se detuvo únicamente ese
contenedor y la consulta posterior por su nombre exacto quedó vacía.

Se comprobaron: aislamiento de canales y credenciales, autenticidad del cifrado,
retos cruzados/repetidos/caducados, permisos revocados antes de persistir,
caducidad y desconexión, snapshots de cola, origen de descargas de audio,
WABA/número equivocados, rechazos e incertidumbre del proveedor, conciliación,
cambio de mes en Colombia, política de unidades y restricciones físicas de BD.
Las pruebas HTTP y de proxy cubren sesión revocada, rol vigente, CSRF, autoridad
del Tenant y prohibición de ampliar el propio cupo. Los transportes externos
están simulados; estos resultados no certifican una conexión real con Meta.

El grep sobre todo `backend/src` confirmó que los cinco puntos de generación de
contenido OpenAI pasan por `executeTenantAi`, y que solo el proveedor del contexto
Comunicación llama a los transportes de texto y plantillas de WhatsApp.

## Activación posterior y pendientes para el cierre

1. Completar la verificación documental de Meta, expresamente pausada, los
   enlaces públicos, logo/categoría, revisión de permisos y aplicación. La app
   nueva está clasificada como proveedor de tecnología y sigue sin publicar;
   Embedded Signup y Facebook Login for Business no tienen aceptación externa.
2. La validación sintética de los cupos iniciales aceptados por Andrés el 29/10
   está documentada, con audio por duración y contextos ponderados:
   100 créditos de prueba una sola vez, 1.000 mensuales en Básico y 3.000 en Pro;
   Personalizado por cotización. Antes de activarlos falta aprobar el presupuesto
   integral y contrastar costos observados. Precios definitivos y ampliaciones siguen
   pendientes. No se ha asignado saldo a negocios reales; una política nueva
   no revaloriza silenciosamente el mes abierto.
3. En un despliegue autorizado, aplicar migraciones y generar cliente antes del
   código que usa las tablas. Configurar la clave de cifrado del servidor y
   conservarla en el procedimiento privado de recuperación. Sin ella los tokens
   cifrados no son recuperables. No guardarla en Git ni enviarla al navegador.
4. Configurar App ID, configuración de Embedded Signup, secreto de la app y
   webhooks firmados. Asignar cupos y política antes de activar las banderas.
   Revisar/drenar la cola heredada antes de habilitar el modo multilínea.
5. Realizar una aceptación externa autorizada con cuentas/números de prueba
   adecuados: conexión, facturación propia a Meta, envío/recepción, renovación
   y desconexión. No usar clientes del centro para certificar el recorrido.

`WHATSAPP_MULTITENANT_ENABLED` y `AI_QUOTA_ENABLED` permanecen desactivadas en
el ejemplo de entorno. La política exige versión y unidades positivas para
las cinco operaciones; no hay un cupo por defecto. Sin configuración comercial
válida no se ofrece el alta de un nuevo negocio. No se han cambiado los `.env`
reales. La coexistencia con WhatsApp Business necesita un recorrido adicional
y no está certificada ni habilitada por esta implementación estándar.

El candidato sigue sin publicación ni tag. Antes del cierre oficial y del
commit final debe evaluarse un incremento menor de versión por estas capacidades
nuevas; código, endpoint de salud y documentación deben coincidir en esa release.
