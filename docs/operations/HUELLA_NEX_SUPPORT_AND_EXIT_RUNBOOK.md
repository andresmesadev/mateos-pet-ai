# Huella Nex: soporte, recuperación de acceso y salida asistida

**Procedimiento del producto.** Mateos Pet es un establecimiento usuario, no el
responsable de soporte de todos los clientes. Andrés atiende inicialmente el
soporte de Huella Nex. El correo configurado del producto es
`huellanex@nexoweb.co`. No se ha establecido aquí una promesa de atención continua
ni un tiempo garantizado de respuesta.

## 1. Abrir y atender una incidencia

1. Asigna una referencia `HN-AAAAMMDD-NNNN` y registra fecha/hora, establecimiento,
   solicitante, canal ya registrado, función afectada e impacto. Mantén un caso
   privado por establecimiento; usa el modelo al final de este documento.
2. Pide pasos para reproducir y referencia de la operación. Evita solicitar
   contraseñas, claves, códigos de verificación o capturas completas con datos de
   otros clientes. Si se necesita una captura, limita su contenido al fallo.
3. Si un cobro tiene resultado desconocido, consulta historial y comprobante antes
   de repetirlo. Si hay indisponibilidad, el negocio continúa en su registro
   alternativo y concilia después para evitar duplicados.
4. Reproduce con datos sintéticos cuando sea posible. Antes de cualquier cambio
   real, acredita la identidad/facultad del solicitante y deja el alcance concreto
   autorizado. «Revisar» no es autorización para cambiar pagos, comisiones o
   información clínica.
5. Registra la actuación, versión o referencia técnica, comprobación y resultado.
   Confirma con el solicitante que puede continuar. Cierra el caso cuando se
   compruebe la resolución; si requiere más verificación, conserva ese estado.

Un correo preparado no se considera enviado, y una comprobación sintética no se
considera una aceptación real de un negocio externo.

## 2. Recuperar al administrador de un establecimiento

- Confirma qué negocio y cuenta se recuperan y que la persona puede solicitarlo.
  Usa un canal previamente registrado y evidencia que ya relacione a la persona
  con esa administración. Conocer un nombre o escribir desde una dirección nueva
  no basta. No envíes datos a un contacto nuevo solo porque lo solicite alguien.
- Si existe otro administrador autorizado del mismo negocio, puede usar el
  restablecimiento existente del equipo. Si se perdió el último acceso, interviene
  el operador técnico de plataforma con el establecimiento seleccionado de forma
  explícita. Comprueba primero su identificador y equipo; no uses una vista de
  todos los negocios para hacer cambios.
- El modo heredado `SINGLE_TENANT_ID` mantiene un fallback para su negocio. Si
  resuelve otro establecimiento, detente. Este procedimiento no autoriza quitar
  esa variable ni cambiar producción para recuperar a un cliente.
- Restablece la credencial mediante el mecanismo existente, manteniendo correo,
  rol, permisos y pertenencia. Acuerda una contraseña nueva por un medio adecuado;
  no la guardes en el caso, capturas o repositorio. No se promete un cambio forzado
  en el siguiente ingreso: esa función no forma parte de este procedimiento.
- Comprueba que la sesión y contraseña anteriores ya no funcionan. Desde la
  pantalla de recuperación, cierra sesión y entra con la nueva contraseña.
  Verifica permisos originales y acceso exclusivo al negocio solicitado.
- Si se perdieron también los canales acreditados, deja el caso pendiente de
  verificación humana. No concedas administración, cambies el correo o desactives
  controles para sustituir esa verificación.

El ensayo técnico de este recorrido está automatizado en el entorno aislado;
la verificación de identidad real sigue siendo responsabilidad del operador.

## 3. Preparar la salida y entrega de datos

1. Recibe una solicitud acreditada del negocio y acuerda alcance, fecha de corte,
   destinatario, medio de entrega, tratamiento de copias de trabajo y si solicita
   también cancelación del servicio. Entregar datos no implica cancelar, suspender
   ni borrar el negocio.
2. Revisa pendientes financieros/operativos sin modificarlos por el hecho de
   preparar la copia. No reescribas comisiones ni cierres históricos.
3. El operador prepara una copia de solo lectura del establecimiento exacto con
   la herramienta siguiente. No es un respaldo global ni se entrega una copia
   de la base que contenga a los demás negocios.
4. Revisa manifiesto, conteos, identidad del negocio, exclusiones y hashes.
   Se conservan identificadores para relacionar registros, importes decimales
   exactos y fechas ISO. El JSON es un formato abierto de datos; no es un PDF de
   cada historia ni una copia restaurable de la aplicación.
5. Los archivos originales alojados en proveedores y las referencias a esos
   archivos requieren revisión aparte si fueron solicitados. No declares una
   entrega íntegra de un alcance que incluya archivos todavía no recopilados.
6. Usa una entrega privada y protegida acordada con el destinatario verificado.
   La herramienta prepara JSON local y **no lo cifra ni envía automáticamente**.
   No publiques la carpeta ni la adjuntes a un issue o repositorio.
7. Conserva en el caso el manifiesto/hash, el alcance realmente entregado y la
   constancia de recepción/apertura. Los hashes detectan cambios respecto de la
   referencia conservada; no son una firma digital ni prueban quién recibió.
8. Documenta por separado la terminación, acceso posterior, proveedores y
   conservación de datos/copias que correspondan al acuerdo. No hay borrado
   automático por esta herramienta ni un plazo universal definido aquí. La
   conservación jurídica/comercial del cliente se revisa antes de su admisión.

## Herramienta técnica de entrega

`scripts/export-tenant-handover.cjs` requiere **todos** los argumentos y una URL
de conexión suministrada explícitamente en `HUELLA_SUPPORT_EXPORT_DATABASE_URL`.
No carga `.env` ni toma `DATABASE_URL` por omisión. La URL es un secreto y no debe
ponerse en el comando, caso o documentación; se proporciona en el entorno privado
del operador. Este ejemplo no ejecuta nada:

```text
node scripts/export-tenant-handover.cjs --tenant=ID_VERIFICADO --case=HN-AAAAMMDD-NNNN --operator=OPERADOR --verified-channel=registered-email --folder=HN-AAAAMMDD-NNNN
```

`verified-channel` es una declaración del operador, no una verificación de correo
automática. También se admite `previously-verified-channel`. No uses estos
parámetros si la comprobación no se ha realizado.

La carpeta nueva queda en `.cache/tenant-handovers/`, excluida de Git. Contiene:

- `data.json`: registros operativos revisados de ese establecimiento.
- `manifest.json`: caso, fecha de corte, conteos, campos/modelos excluidos y hash.
- `SHA256SUMS`: referencias de integridad de los dos archivos.

Se revisan 43 grupos de registros y se declara la exclusión del resto del modelo:
credenciales/sesiones/pruebas de autoridad, conexiones de proveedores, colas y
trazas técnicas, vectores y catálogos globales no específicos. Los campos técnicos
omitidos se enumeran en el manifiesto. No se promete una réplica de toda la base.

La consulta usa una transacción de solo lectura y una vista consistente. Una
referencia ajena o no resuelta, campos/modelos nuevos sin revisar, más de 50.000
filas en un grupo o una carpeta ya existente detienen la preparación; no se
trunca ni sobrescribe una entrega en silencio. Antes de usar el paquete con datos
reales se revisan su volumen, destino y alcance solicitado.

## Modelo privado de registro del caso

Conserva fuera de Git y de páginas públicas:

```text
Referencia:
Establecimiento (ID y nombre confirmado):
Fecha/hora de apertura:
Solicitante y facultad comprobada:
Canal previamente acreditado y referencia de la comprobación:
Solicitud, impacto y alcance autorizado:
Responsable de atención:
Actuaciones y fechas (sin contraseñas, tokens ni copias de datos completas):
Comprobaciones y resultado:
Para entrega: corte, destinatario, alcance, exclusiones y manifiesto/hash:
Recepción/apertura confirmada por el destinatario:
Pendientes de terminación, proveedores y conservación:
Estado y motivo (abierto / pendiente / resuelto):
Fecha y condición de cierre:
```

La documentación privada del caso es un procedimiento manual, no un sistema de
auditoría inmutable. No sustituye los registros inmutables del dominio ni prueba
por sí sola autorización o recepción.
