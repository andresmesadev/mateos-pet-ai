# Huella Nex: soporte, recuperación de administrador y entrega asistida

**Fecha:** 30/10/2026, Colombia. **Punto 3:** procedimiento preparado y ensayo
técnico local aprobado. No acredita identidad, recepción o baja de un negocio
real ni abre por sí solo la beta externa.

## Resultado

Se reutilizaron los tres negocios sintéticos de los ciclos operativos del punto
1, con cuentas reales de NextAuth, proxy autenticado y PostgreSQL aislado. Se
añadieron una cuenta técnica de plataforma, registros clínicos con revisión,
conversaciones/mensajes, configuración de asistentes y datos señuelo de seguridad.

El recorrido comprobó:

1. Un administrador de otro negocio no puede restablecer la cuenta objetivo,
   incluso intentando seleccionar su tenant por query. La credencial no cambia.
2. El operador de plataforma selecciona explícitamente el negocio y usa la ruta
   existente para cambiar únicamente la contraseña de su administrador. Conserva
   correo, rol, permisos y pertenencia.
3. La sesión anterior recibe rechazo, el navegador presenta la recuperación y
   puede cerrar sesión. La contraseña anterior falla; la nueva permite entrar
   con la misma cuenta, sin convertirla en administradora de plataforma. La
   credencial del otro negocio permanece igual.
4. Se prepara una copia consistente de solo lectura de los registros operativos
   revisados, incluyendo hijos sin `tenantId`: historias/revisiones, mensajes,
   tareas/decisiones y renglones de cobro por su transacción propietaria. Esta
   última relación conserva también los renglones históricos con tenant nulo.
5. Se concilian los conteos de los 43 grupos incluidos contra el origen y se
   comprueba una segunda copia del pet shop con artículos y pago mixto. No se
   incluyen los señuelos del negocio ajeno, hashes de contraseña, clave API,
   estado privado de sesión ni referencia técnica de facturación omitida.
6. Una referencia de cita a personal ajeno detiene la preparación. Una alteración
   del archivo falla en la verificación. El caso conserva referencias de
   integridad y nunca contraseñas ni copias completas de datos en su relato.
7. La herramienta CLI se ejecuta contra la misma base temporal usando una
   variable de conexión explícita. Genera tres archivos verificados con los mismos
   conteos; no modifica cierres ni existencias ni sobrescribe una entrega previa.

El registro privado del caso contiene ocho hitos: apertura, intento ajeno
rechazado, verificación de identidad **simulada**, actuación, comprobación de
recuperación, solicitud de copia, verificación de paquete y cierre del ensayo.
No se envía ningún mensaje, archivo ni contraseña a un tercero.

## Entregables

- [Procedimiento de soporte y salida](../operations/HUELLA_NEX_SUPPORT_AND_EXIT_RUNBOOK.md),
  con responsable/canal, modelo de caso, pérdida de acceso, destino verificado,
  entrega, constancia y decisiones separadas de conservación/terminación.
- [Diseño acotado](../architecture/support-and-tenant-handover-20261030.md): lectura
  operacional sin entidad de tickets, endpoint nuevo ni cambio de dominio.
- `scripts/tenant-handover.cjs`: campos permitidos explícitamente, clasificación
  del modelo generado, scoping directo/por relación y transacción
  `REPEATABLE READ` declarada `READ ONLY`.
- `scripts/export-tenant-handover.cjs`: entrada técnica explícita. No carga `.env`
  ni usa por omisión la conexión de la aplicación; no imprime registros ni
  errores crudos del driver.
- Pruebas unitarias y escenario `--support-lifecycle` reutilizando el harness
  PostgreSQL/navegador ya existente.

El paquete incluye `data.json`, `manifest.json` y `SHA256SUMS`. Son archivos de
datos abiertos, no una réplica restaurable del servidor. El manifiesto detalla
modelos y campos omitidos. Solo se agregan descriptores del catálogo global de
eventos cuando son referenciados por las reglas propias; no se vuelca ese catálogo.

La herramienta no cifra, envía, suspende, elimina ni desconecta proveedores. El
procedimiento exige acordar y usar un medio privado/protegido para una entrega
real. Los hashes son referencias de integridad, no una firma ni prueba de entrega.

## Evidencia final

```text
node scripts/verify-onboarding-local.cjs --support-lifecycle
Onboarding integration: 22 passed, 0 failed.
PASS own temporary PostgreSQL container removed
```

La ejecución crea PostgreSQL con nombre y puerto exclusivos, aplica todas las
migraciones desde vacío, comprueba cero diferencias frente al esquema y elimina
únicamente su contenedor al finalizar. Se mantuvo el contenedor local de desarrollo.
No se usó ni modificó la VPS o la operación de Mateos Pet.

```text
Flujos Node: 42 archivos, 290 pruebas, 290 pass, 0 fail
ESLint frontend: exit 0, sin diagnósticos
Node --check: siete archivos de soporte/harness/pruebas aprobados
git diff --check: sin errores
```

Las cinco pruebas nuevas de exportación cubren cambios de esquema sin revisar,
referencias ajenas, caso verificado obligatorio, lectura consistente/solo lectura,
destino privado, no sobrescritura, alteración y rechazo de CLI ambiguo sin conexión.
Se corrigió además el doble de navegador de la prueba de navegación de
Administración, al que le faltaba `requestAnimationFrame` tras la mejora de
desplazamiento del punto 2; ahora comprueba también el destino visible.

Evidencia sintética excluida de Git en `.cache/support-lifecycle/` y
`.cache/tenant-handovers/`: caso, referencias de integridad, captura de acceso
recuperado y paquetes. No se presentan como evidencia de identidad humana real.

## Límites y decisiones

- La verificación del solicitante es humana: el argumento de la herramienta es
  una declaración del operador, no un correo verificado automáticamente.
- La administración técnica se ensayó en modo multi-establecimiento, sin el
  fallback heredado, solo dentro del proceso aislado y restaurándolo al terminar.
  No se autoriza cambiar `SINGLE_TENANT_ID` en producción por este procedimiento.
- El paquete es de registros operativos revisados. Archivos originales en
  proveedores, vectores, claves/sesiones y trazas internas quedan fuera conforme
  al manifiesto. Si la solicitud incluye archivos originales, se revisan aparte
  antes de declarar satisfecha esa entrega.
- Los grupos vacíos también se concilian; no se afirma haber poblado todas las
  variantes de cada entidad o probado volúmenes grandes. Se rechaza superar
  50.000 filas por grupo; no se trunca silenciosamente.
- Se mantuvo la advertencia de deprecación de consultas concurrentes de `pg` ya
  documentada. No afectó las comprobaciones ni se oculta como ausencia absoluta
  de advertencias.
- No hubo cambios de código de aplicación, esquema ni permisos de producción en
  este punto. La versión candidata continúa en 2.58.3, sin tag, commit, push o
  despliegue nuevos. Los resultados previos de backend/build no se cuentan como
  una ejecución nueva de este punto.

Queda preparada la parte técnica y el procedimiento asistido del punto 3. Cada
caso real requerirá acreditar al solicitante, acordar su alcance y conservación,
ejecutar la actuación autorizada y registrar recepción/resolución. Esto no
sustituye las condiciones comerciales/privacidad ni la aceptación del primer
participante externo.
