# Huella Nex — revisión final local del lote

**Fecha:** 29/10/2026. **Base:** árbol de trabajo local, candidato 2.58.3.
**Resultado:** recorrido local del alcance revisado aprobado con las
integraciones comerciales externas todavía deshabilitadas. Sin commit, push,
tag ni despliegue. No equivale a cierre de HN-04 ni autorización comercial.

## Alcance y método

Se revisaron los cambios de identidad del producto y los hallazgos HN-01 a
HN-07 de la [revisión independiente](HUELLA_NEX_PRODUCT_REVIEW_20261028.md):
registro, acceso por actividad, planes, suspensión comercial, configuración de
IA/WhatsApp, identidad de mensajes y preparación parcial de cuentas.

Huella Nex es el software para veterinarias, peluquerías y pet shops. Los
establecimientos de esta revisión son sintéticos e independientes del centro
real Mateos Pet. No se usaron sus clientes, historias, pagos o existencias.

Se ejecutó una compilación optimizada de Next, las suites automatizadas y el
recorrido real de navegador contra Express, NextAuth y PostgreSQL temporal.
Stripe fue sustituido por un adaptador simulado que registra solo las acciones
esperadas; WhatsApp y los cupos comerciales estuvieron desactivados. Las
solicitudes del navegador fuera del servidor local se bloquearían y se
contabilizarían: no se observaron intentos externos en el recorrido final.
Las fuentes públicas de Google sí se descargaron durante la compilación;
esa descarga no involucra datos de establecimientos ni proveedores operativos.

## Evidencia real de validación

| Comprobación | Resultado final |
| --- | --- |
| Jest backend completo | 235 suites; 2.114 pruebas aprobadas; cero fallos o pendientes. |
| Flujos Node y scripts | 41 archivos; 285 pruebas aprobadas; cero fallos. |
| PostgreSQL, proveedores comerciales | 17 pruebas aprobadas; concurrencia, aislamiento y conciliación. |
| Navegador con Express y NextAuth reales | 23 comprobaciones aprobadas; cero fallos. |
| Diseño adaptable | 60 verificaciones en 15 vistas/estados a 320, 390, 768 y 1.440 px; sin desbordamiento horizontal. |
| Compilación optimizada Next | Exit 0; TypeScript incluido; 36 páginas estáticas generadas y rutas dinámicas disponibles. |
| `npm run lint` frontend | Exit 0; sin errores ni advertencias. |
| Sintaxis de los cuatro scripts de verificación | `node --check`, exit 0 en todos. |
| Migraciones y deriva | 68 migraciones aplicadas desde vacío; `migrate diff --exit-code` terminó en 0 en la base desechable del navegador. |

Los 60 controles de diseño forman parte de los recorridos del navegador; no
son 60 operaciones comerciales adicionales. Las suites automatizadas también
se solapan en criterios: sus cantidades se informan por tipo y no como suma
de capacidades certificadas.

## Recorridos comprobados

| Recorrido | Observación final |
| --- | --- |
| Registro completo | Cuenta y administrador con contraseña protegida mediante hash; login real; sin canal heredado ni cobro. |
| Veterinaria sola | Acceso y navegación veterinaria; sin peluquería. |
| Peluquería sola | Acceso y navegación de peluquería; sin consultas clínicas. |
| Pet shop solo | Operación comercial y clientes; sin menús clínicos ni peluquería. |
| Separación de clientes | Seleccionar otro tenant en la URL no permite leer su cliente desde un negocio autenticado. |
| Facturación | Evaluación, Básico, Pro y Personalizado; precios como referencia y alcance explícito. |
| Checkout simulado | El servidor selecciona el precio permitido de Básico; la vuelta con `success=1` no confirma por sí sola la suscripción. |
| Suspensión | Operaciones devuelven 402; facturación y portal simulado siguen disponibles. |
| Cambio de rol | Una sesión existente pierde autoridad comercial al revocar su rol administrativo en persistencia. |
| IA | Negocios nuevos sin saldo heredado y sin facultad para asignarse cupo. |
| WhatsApp | Conexión no configurada visible; sin migrar una línea ni iniciar Meta. |
| Reactivación | Dos negocios ven sus propios nombres en la plantilla; canal pausado impide enviar y no genera métricas de contacto. |
| Alta parcial | `pending` permanece visible y ofrece soporte y dashboard sin duplicar cuenta. |
| Estado de preparación desconocido | No se convierte en éxito completo; conserva la recuperación. |
| Fallo de login posterior al alta | Cuenta conservada, aviso pendiente visible y enlace para iniciar sesión; un segundo submit no crea otra cuenta. |
| Sesión revocada | La credencial desactivada pierde acceso desde su sesión previa. |

El navegador comprobó también la disponibilidad de identificadores, cancelación
de respuestas antiguas, contraseña de confirmación, origen externo rechazado,
sesión anónima y recuperación mediante login real. Las siete combinaciones de
módulos se cubren adicionalmente en las pruebas del formulario y backend; el
recorrido visual utiliza cada uno de los tres nichos por separado.

## Hallazgos menores corregidos durante esta revisión

1. **Una cuenta en evaluación mostraba “Inactivo” como estado de suscripción.**
   La ausencia de suscripción ahora se muestra como “Sin suscripción”, un estado
   desconocido como “Por confirmar” y el campo se llama “Estado de suscripción”.
   Esto no cambia `Tenant.active`, permisos ni cobros. Se añadió una regresión
   que ejecuta el componente real con estados ausente, desconocido, activo y
   pago pendiente.
2. **La ruta de navegación exponía `integrations`.** Se incorporó la etiqueta
   “Integraciones”, conservando la URL técnica y el establecimiento seleccionado.

Tras esas correcciones se repitieron compilación, pruebas de flujos, lint y el
recorrido visual completo. Las interrupciones previas del arnés se debieron a
selectores que incluían contenido oculto de navegación y al aviso automático
de Next; se delimitaron a elementos visibles de la región correspondiente.
El primer build falló por restricción de red para descargar fuentes y pasó con
esa descarga permitida; no se sustituyeron las fuentes para ocultar el fallo.

## Revisión visual y accesibilidad acotada

Se inspeccionaron capturas reales de planes, integraciones, inicio por actividad
y alta parcial, tanto en escritorio como en móvil. Se revisaron la claridad
de estados, lectura, nombres del negocio y del producto, distribución y
ausencia de recortes horizontales. En recuperación de alta se comprobó foco
por teclado desde el enlace de soporte hasta la acción de continuar.

Esto **no** es una certificación WCAG completa: no se realizó una sesión con
lector de pantalla ni una auditoría exhaustiva de todos los colores, pantallas
y estados operativos del software. No se afirma compatibilidad mundial por
estos resultados; moneda y zona de negocio conservan su alcance documentado.

## Aislamiento, evidencia y limpieza

El arnés de navegador reutiliza `scripts/verify-onboarding-local.cjs` con
`--product-final-review` y dos módulos de prueba propios. Crea un contenedor
con nombre aleatorio `onboarding-check-*`, etiqueta de propósito, puerto local
aleatorio y datos en tmpfs. La prueba de proveedores utiliza otro contenedor
`huella-final-provider-check-*`, usuario `provider_test`, base
`huella_provider_check` y puerto local 55440, exigidos por el test.

Antes de retirarlos se comprobaron sus identidades; en el segundo caso también
etiqueta, puerto y tmpfs. Ambos fueron eliminados. La consulta final de Docker
solo muestra el contenedor previo `mateos-pet-ai-dev-db-1`, en 127.0.0.1:5433,
saludable y sin modificaciones por esta revisión. Se cerraron navegador y
servidores temporales. No se ejecutaron jobs operativos ni se tocó la VPS.

La evidencia local está en `.cache/product-final-review/`: 36 capturas PNG y
`review-observations.json`, ignorados por Git. Contiene nombres y correos de
demostración; no contraseñas ni tokens de sesión. El JSON registra 60 controles
de diseño y únicamente `checkout`/`portal` simulados, sin importes ni pagos
reales. Las capturas no se presentan como evidencia de un tenant productivo.

## Pendientes y criterio de publicación

- **HN-04 sigue abierto:** documentación y aprobación de Meta, configuración
  definitiva, presupuesto/oferta de IA y aceptación externa autorizada.
  [Lista de activación](../architecture/commercial-providers-validation-hn04-20261028.md#activación-posterior-y-pendientes-para-el-cierre).
- Este resultado permite preparar una publicación manteniendo desactivadas
  las capacidades comerciales que requieren esa aceptación. No permite activar
  canales nuevos ni asignar saldos reales por inferencia.
- El lote acumulado sigue sin publicar. Antes del commit y tag se debe evaluar
  un incremento **menor** por las capacidades nuevas de HN-04, no tratar todo
  el lote como un cambio de textos: versión de código, salud y documentación
  deben coincidir. No se cambió versión ni se creó un tag en esta revisión.
- El despliegue requiere respaldo, migraciones aditivas y cliente Prisma antes
  del código que usa las tablas, secretos de cifrado y revisión de la cola;
  esas acciones siguen pendientes de una instrucción de publicación.

**Conclusión:** no se encontraron nuevos bloqueos locales sin resolver dentro
del alcance revisado. Se mantiene el límite comercial externo de HN-04. No se
declara que todo el software carezca de defectos ni que esta revisión sea una
nueva fase o el cierre oficial de la beta.
