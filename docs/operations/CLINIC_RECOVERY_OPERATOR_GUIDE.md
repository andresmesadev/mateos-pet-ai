# Qué hacer si la aplicación falla — Andre y Lina

Guía para la operación real de Mateos Pet. Responsable: Andre. Suplente: Lina.
El registro alterno confirmado es el Excel que utilizaban antes de la aplicación.

## 1. Un cobro o guardado quedó sin respuesta

1. Anotar la hora, la operación, el importe y el medio de pago en el registro
   privado habitual. Marcar **«resultado por verificar»**.
2. Avisar a Andre. Si el cliente entregó dinero, dejar constancia del dinero
   realmente recibido; no cobrarle de nuevo por un fallo de la pantalla.
3. Cuando vuelva a responder, revisar **Punto de venta → Historial de cobros →
   Comprobante**. Comparar cliente/mascota, importe y método de pago.
4. Si ya existe, usar ese comprobante. Si no aparece o hay dudas, Andre revisa
   el resultado antes de repetir el registro. Una pantalla de error por sí sola
   no demuestra que el cobro haya fallado.

## 2. La aplicación continúa sin funcionar

1. Seguir atendiendo con el Excel habitual. Identificar qué registros quedaron
   pendientes de ingresar y cuáles tienen resultado incierto.
2. Conservar comprobantes y referencias de los pagos recibidos. No registrar
   una compra por segunda vez para intentar arreglar la conexión.
3. Andre coordina el diagnóstico y decide si se requiere recuperar datos.
   Una caída de internet del puesto no implica restaurar la base de datos.
4. Conservar los registros del incidente. No borrar ni reinstalar la aplicación,
   eliminar datos o restaurar una copia sobre la base operativa por iniciativa
   del puesto de atención.

## 3. Dónde está la copia de recuperación

**Configuración vigente desde el 28/10/2026:** la VPS genera los respaldos
automáticos cada 30 minutos en `/var/backups/mateos-pet-ai`. Andre o el técnico
accede a esa ubicación y verifica la fecha y la suma antes de recuperar datos.

La tarea automática del computador se retiró por solicitud de Andre a las
14:31 Colombia. Sus copias descargadas se conservaron, pero ya no se actualizan.
Para consultar una de esas copias históricas, abrir el Explorador y pegar:

```text
C:\Users\andre\Desktop\Proyectos\mateos-pet-ai\backups\offsite
```

Los conjuntos se llaman `mateos-pet-ai-AAAAMMDDTHHMMSSZ`. La fecha del nombre
está en **UTC**: restar cinco horas para Colombia. Cada conjunto completo debe
tener `database.dump.age`, `SHA256SUMS` y `manifest.txt`.

No abrir ni editar esos archivos. No enviarlos por correo/chat ni compartir
la clave privada. El técnico comprueba la suma, descifra y restaura primero
en una base aislada siguiendo la [guía técnica](DATABASE_BACKUP_AND_RESTORE.md).
El destino definitivo debe identificarse y autorizarse antes de reemplazar datos.

La VPS mantiene su respaldo automático aunque el computador esté apagado.
Revisar el resultado de esa tarea y la fecha del último conjunto. La copia
externa reciente dejó de automatizarse por decisión del operador; las copias
locales históricas no acreditan una pérdida máxima de una hora si se pierde
la VPS completa. Ante un incidente, Andre confirma qué copia está disponible
y su fecha antes de decidir la recuperación.

## 4. Antes de volver al registro normal

Andre y Lina comprueban acceso con sus cuentas personales, agenda, clientes,
existencias y comprobantes conocidos. Se contrastan los registros del Excel
con lo recuperado y se ingresan únicamente los pendientes confirmados, conservando
sus referencias. No duplicar cobros ni ajustar stock a ciegas.

Anotar el inicio del incidente, hora del respaldo utilizado, hora de recuperación
y diferencias encontradas. Los objetivos aceptados son perder como máximo
una hora de registros y recuperar el servicio en una hora. La restauración
aislada de PostgreSQL ya fue probada; el tiempo completo incluye diagnóstico,
acceso al respaldo, recuperación de la aplicación y estas comprobaciones.

## Práctica asistida del 27 de octubre

- [x] Andre confirmó que Lina está presente para la práctica.
- [x] Respuesta del equipo: Lina avisaría a Andre y anotaría en el Excel habitual.
- [x] Se explicó el tratamiento de cobros con resultado incierto y la revisión
  del historial antes de repetir un registro.
- [x] Comprobación técnica a las 11:20 Colombia: tarea externa cada 15 minutos,
  último resultado `0`, respaldo de las 11:00 presente y suma correcta.
  Timer VPS activo, último respaldo correcto, salud 2.58.1 correcta y WhatsApp pausado.
- [x] El equipo confirmó que Lina encontró un cobro existente desde su cuenta,
  abrió el comprobante y verificó importe y método de pago sin modificarlo
  ni repetir el cobro.
- [x] El equipo confirmó que Lina encontró la carpeta de respaldo más reciente
  y los archivos `database.dump.age`, `SHA256SUMS` y `manifest.txt`, sin editarlos
  ni compartirlos. La interpretación de la fecha UTC se explica en esta guía;
  no se considera comprobada solo por haber localizado los archivos.
- [x] Ensayo técnico asistido de recuperación de base, backend y frontend,
  sesión y consultas, con todas las tablas conservadas. Práctica completa:
  3 min 55,639 s, incluyendo primer fallo, ajuste y limpieza. No se provocó una
  caída real ni se crearon entradas ficticias de Excel que conciliar después.
  [Acta y límites de la medición](RECOVERY_APPLICATION_DRILL_20261027.md).

La práctica operativa es verbal y de consulta, complementada por el ensayo
técnico aislado. No provoca una caída ni registra operaciones ficticias en la
base de la veterinaria. La restauración la ejecutó la herramienta bajo
coordinación de Andre; no acredita autonomía de Lina para administrar SSH o
PostgreSQL. La medición supone VPS e imágenes disponibles y no certifica
reemplazar el servidor ni recuperar integraciones externas en una hora.
