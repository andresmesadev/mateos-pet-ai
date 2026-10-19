# Aplicación de la preparación de beta propia

**Fecha:** 16 de octubre de 2026. **Producto vigente:** 2.48.0, publicación `9ee264d`. Se aplica la [revisión de preparación](OWN_CLINIC_BETA_REVIEW_20261016.md) autorizada por el responsable. No cambia el dominio, schema, versión ni aplicación desplegada; no se abre una fase nueva.

**Cambio posterior indicado por el responsable:** [base limpia y dashboard sin WhatsApp](DASHBOARD_ONLY_CLEAN_START_20261016.md), aplicado a las 10:24 Colombia. La captura de las 09:51 y los conteos de la base anterior de este documento quedan como evidencia histórica. La observación vigente empezó a las 10:25. No copiar servicios, personal ni cuentas de ejemplo hasta su revisión.

**Decisión recibida durante la aplicación:** agenda y recepción primero; caja e inventario después. El responsable autorizó expresamente copiar el nuevo respaldo cifrado a `backups/offsite/` de este equipo y restaurarlo temporalmente en Docker local aislado, incluyendo los registros/conversaciones/datos personales existentes. Esa autorización concreta permitió completar el ensayo siguiente.

## Cambios aplicados

| Acción | Evidencia / límite |
| --- | --- |
| Registrar Financiero y Administración/Inventario | API administrativa HTTPS, sesión del administrador existente, establecimiento coherente con Recepcionista/Agenda. Respuestas 201 para ambas especializaciones y listado operativo con dos empleados activos. Sesión de herramienta cerrada. No se crearon tareas, gastos, entradas ni vínculos privados. |
| Observar sin depender del PC | Servicio systemd finito y contenedor separado, imagen local fijada por SHA; sin entorno ni volúmenes del negocio. Instalación y fuentes verificadas. [Procedimiento](PERSISTENT_STABILITY_OBSERVATION.md). |
| Fijar versión esperada | El resumen del observador rechaza una ventana saludable íntegra de otra versión; regresión automática añadida. Mantiene los criterios existentes de continuidad, fallos y reinicios. |
| Preparar el uso del negocio | [Acta, apertura/cierre, carga inicial y aceptación](OWN_CLINIC_STARTUP_WORKSHEET.md). Plantillas vacías para completar privadamente, sin inventar operadores, existencias o importes. |
| Preparar revisión de datos reales | [Borrador de alcance](../legal/anexo-beta-veterinaria-propia-borrador.md), separado del paquete 1.1 histórico. Reutiliza identidad/contactos privados; conserva decisiones pendientes sobre finalidades, acceso, proveedores y conservación. No representa aprobación jurídica ni autorización de clientes. |
| Actualizar y ensayar respaldo | Conjunto VPS `mateos-pet-ai-20261016T145141Z`, posterior a la publicación y alta de empleados. Servicio `Result=success`, `ExecMainStatus=0`; checksum cifrado `79095794a8ddf633838e214cbb455de0d443bd9f4637a479ee4a25c2b147beb4`, 692.829 bytes. Copia independiente verificada y restauración local aprobada: 69 tablas, 52 migraciones, 21 tablas nuevas presentes y cero FKs/checks sin validar. |
| Reducir alcance inicial | Dashboard y tareas existentes; comercialización, Stripe, campañas, número empresarial y canal privado de operadores quedan separados del arranque propio. No se elimina código ni controles de aislamiento. |

## Ventana de salud iniciada

- Servicio: `mateos-pet-ai-stability.service`, activo al comprobar después del inicio.
- Archivo VPS: `/var/lib/mateos-pet-ai/stability/ventana-2.48.0-20261016T145200Z.jsonl`.
- Primera muestra real: **2026-10-16 14:51:41.496 UTC / 09:51:41.496 Colombia**; versión 2.48.0, HTTP 200, base/OpenAI/worker sanos, cero fallos consecutivos.
- Fin previsto: **18 de octubre, 09:51:41 Colombia**, condicionado a continuidad y resultado de todas las muestras. El nombre del archivo identifica la ventana; el inicio se toma de la muestra real.
- Worker de la aplicación conserva inicio **14:21:45.196 UTC**; el observador no lo reinició.
- Imagen observadora: `sha256:10b8d8bf35608cdcd562b5bf22a8a70dd30ad8359909512bf5c5c2e5afeb9d33`, reutilizada localmente.

Huellas de las cuatro fuentes instaladas, coincidentes con el workspace:

| Fuente | SHA-256 |
| --- | --- |
| `observe-production.cjs` | `c4c40b79ed4cb30dd4e8df9d855261131316818291b4fe7ad4d463a5d794fb5e` |
| `run-stability-window.sh` | `19107b24ab5bfc60fa16cc604acc68626d61413401dcb37ff5a0df3eedc172e4` |
| `install-stability-service.sh` | `57bcf59d69320103cdcf43368787255c90d558b3f686564af5ef0447764bcab7` |
| Unidad systemd | `e64f94fb8a34dd4ecabf9eebbf0060be7e038ce221ff779510771ab057885ad2` |

La transferencia de fuentes produjo un aviso del decodificador por el fin de línea de la tubería de Windows; las cuatro huellas completas se verificaron después contra los archivos locales y coincidieron. `systemd-analyze verify` terminó con código 0; mostró avisos preexistentes de unidades snap del host, sin error de la unidad observadora.

## Pendiente de decisiones o ejecución humana

1. Con agenda/recepción ya elegidas, completar responsable/suplente, soporte, corte y fuente de verdad en el acta; completar cuentas personales sobre las fichas existentes.
2. Revisar y aprobar el alcance documental de datos reales; preservar el paquete ficticio anterior y evidencias privadas.
3. Contrastar servicios/precios/horarios de agenda con el negocio. Catálogo, conteos y conciliación de caja/stock quedan para su ampliación posterior. No se cargó ningún saldo supuesto.
4. Practicar la recuperación con el suplente y acordar RPO/RTO; la restauración técnica nueva ya terminó correctamente. La copia diaria autorizada conserva su funcionamiento independiente.
5. Completar y revisar 48 h, cola/entregas y una jornada con el equipo real. La observación en curso no cierra estabilidad ni aceptación.

WhatsApp privado continúa deshabilitado. No se cambiaron cuentas, roles, horarios, datos operativos existentes ni línea de Meta. La confirmación humana de gastos/stock sigue siendo obligatoria.

## Validación de esta ronda

- `node --test scripts/observe-production.test.cjs scripts/check-docs.test.cjs scripts/capacity-tools.test.cjs scripts/copy-offsite-backup.test.cjs`: **23 aprobadas, cero fallidas**, exit 0; incluye el rechazo de otra versión saludable.
- Sintaxis de Node y ambos scripts Bash: correcta. Ensayo del instalador con imagen inválida y ventana de otra versión: rechazos 64 antes de mutaciones del sistema. Unidad verificada y contenedor arrancado en la VPS.
- `npm run lint` en frontend: **exit 0**. No cambió código de frontend/backend, dependencias, migraciones ni contratos de negocio; se conserva la regresión de la publicación anterior.
- Inventario documental: **335 documentos, 315 Markdown, 1.047 enlaces; cero enlaces rotos, referencias ausentes, rutas no portables o errores de catálogo**. `git diff --check`: exit 0.
- Comprobación agregada VPS **14:56:16 UTC**: 52 migraciones aplicadas; una instancia activa de cada empleado (Recepcionista, Agenda, Financiero y Administración). Citas 11, usuarios 3, mensajes 226; gastos/transacciones/comisiones/productos/movimientos/solicitudes operativas/vínculos privados 0. Cola 244 `done/complete`. Los conteos operativos anteriores se conservaron.

La consulta agregada inicial usó `state` en lugar de `status` para la cola y se detuvo sin escribir datos. Se corrigió contra el esquema y la comprobación anterior terminó correctamente. No se usa ese intento fallido como evidencia de salud o migración.

**Seguimiento del observador, 15:01:41 UTC:** tres muestras sanas, misma versión y mismo inicio de worker. Contenedor con raíz de solo lectura, 128 MiB, capacidades eliminadas, usuario 1001:1001, sin puertos publicados y sin reinicio automático. Checkout productivo limpio.

## Recuperación actual comprobada

Se reutilizó la imagen local `pgvector/pgvector:0.8.6-pg18-bookworm`. El descifrado fluyó directamente a `pg_restore` dentro del PostgreSQL temporal con red `none` y sin puertos publicados; la clave permaneció en el equipo y no se escribió un dump plano. El script conserva su limpieza por identificador propio también ante fallo. Se añadieron comprobaciones opcionales de historial esperado y tablas requeridas, con nombres restringidos antes de formar SQL.

Salida real del ensayo:

```text
database.dump.age: OK
restore schema checks passed: required_tables=21 unvalidated_constraints=0
restore drill passed: tables=69 migrations=52
RESTORE_EXIT=0
```

Se verificó la retirada del contenedor y su volumen temporal tras el ensayo. El respaldo cifrado independiente y su recibo permanecen fuera de Git. Esta restauración prueba integridad y esquema actual; no declara completado un nuevo ensayo de derechos de privacidad sobre datos reales ni un RTO operativo con suplente.

Guardas adicionales comprobadas: contador negativo y nombres con SQL rechazados antes de acceder a archivos, comprobar herramientas o crear un contenedor. Los primeros intentos de esas guardas quedaron detenidos por dependencias/rutas del sandbox; se adelantó la validación de argumentos y ambos negativos pasaron sin usar una clave real. No se eliminó ningún volumen ajeno al contenedor del ensayo.

Para el descifrado se descargó `age` 1.3.2 portátil desde la [publicación oficial](https://github.com/FiloSottile/age/releases/tag/v1.3.2), únicamente a `.cache/tools/`. SHA-256 del archivo Windows comprobado contra el digest de su publicación: `f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`; ejecutable reportó `v1.3.2`. No se instaló globalmente.

Se abrió una copia de trabajo privada en `.cache/private/own-clinic/acta-primera-jornada.md`, excluida de Git, para completar decisiones y datos de apertura. Los documentos públicos siguen sin datos personales. Los cambios de fuente/documentación de esta ronda quedan locales; el alta, respaldo y observador sí se aplicaron en la VPS con las evidencias indicadas.
