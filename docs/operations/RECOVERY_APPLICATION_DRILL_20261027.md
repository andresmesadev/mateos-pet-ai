# Ítem 5 — recuperación de aplicación y práctica asistida, 27/10/2026

## Resultado y alcance del cierre

Se cierra el criterio original del ítem 5 para la beta manual de la veterinaria:
**respaldo cifrado periódico, retención definida, copia independiente y
restauración ensayada**, actualizados al esquema vigente. Se completó además
la práctica asistida con Andre y Lina: aviso y registro alterno, comprobante y
localización del respaldo.

Los objetivos aceptados son RPO de una hora y RTO de una hora. Este ejercicio
midió la recuperación de datos y arranque/consulta de la aplicación **con la
VPS y las imágenes disponibles**. No certifica reconstruir una VPS perdida,
restablecer DNS/TLS ni recuperar integraciones externas en una hora. Se conserva
esa distinción al declarar el cierre; no es una garantía general de desastre.

## Preparación y evidencia

- Producción 2.58.1 funcionando, base y OpenAI saludables, WhatsApp pausado.
  No se detuvo ni reinició producción ni el observador de estabilidad.
- Respaldo VPS cada 30 minutos y copia externa cada 15 minutos, autorizados
  por el responsable. La revisión de las 11:20 encontró ejecución externa
  con resultado `0`, respaldo de las 11:00 presente y suma correcta.
- Se usó después el conjunto externo más reciente disponible:
  `mateos-pet-ai-20261027T163003Z`, generado a las **11:30:03 Colombia**,
  541.279 bytes y SHA-256 correcto. La copia ya estaba disponible en el
  computador antes de iniciar el intento cronometrado.
- Descifrado local por tubería, transmisión por SSH a contenedores nuevos
  en la misma VPS. No se copió la clave privada al servidor ni se escribió
  un archivo de dump descifrado en el equipo.
- PostgreSQL aislado con red `none`; backend y frontend compartieron solo
  ese espacio de red. **Cero puertos publicados y sin conectividad externa.**
  Cada contenedor limitado a 1 CPU/1 GiB; preflight exigió más de 4 GiB de
  memoria disponible y 20 GiB libres en disco.
- Se utilizaron las imágenes ya desplegadas, identificadas por ID inmutable;
  no se reconstruyeron ni sustituyeron las imágenes productivas.
- Se suprimieron los seis jobs de arranque mediante un preload exclusivo del
  contenedor temporal. La aplicación utilizó un rol PostgreSQL con SELECT y
  transacciones de solo lectura, sin permiso de escribir en las tablas restauradas.

## Comprobaciones sobre la copia

1. Restauración con `pg_restore --exit-on-error`: **73 tablas y 66 migraciones
   aplicadas**, sin FKs/checks sin validar ni índices inválidos.
2. Arranque de backend y frontend 2.58.1. Se creó una credencial administrativa
   efímera exclusiva del contenedor para entrar por el flujo normal de NextAuth;
   no se utilizó ni cambió la contraseña real de Andre o Lina.
3. Inicio de sesión comprobado y **HTTP 200 en diez lecturas**:
   `/dashboard`, calendario, clientes, POS e inventario; proxy de permisos,
   clientes, citas de hoy, productos de inventario y transacciones.
4. Base de datos del backend recuperado `ok`, versión 2.58.1. La salud de
   OpenAI en el entorno aislado no se certificó: la red externa estuvo bloqueada
   y no se entregó una clave de API real. Tampoco se hicieron cobros, envíos,
   consumos o cambios de estado para simular operaciones productivas.
5. **Huellas de las 73 tablas idénticas antes y después** de las comprobaciones.
   La comparación demuestra que el ensayo no cambió esa copia; no pretende
   comparar la fotografía del respaldo con producción que sigue en uso.
6. Contenedores, volúmenes anónimos y credenciales efímeras eliminados. La
   comprobación final no encontró contenedores con la etiqueta del ensayo.
   Salud productiva `ok` a las **11:38:40 Colombia**, observador y timer activos.

## Medición sin ocultar el primer intento

El primer intento comenzó a las **11:34:44,402 Colombia**. La restauración
funcionó, pero el backend temporal no arrancó porque el SDK de salud esperaba
la variable de configuración de OpenAI. Se diagnosticó el error, se limpiaron
sus recursos y se corrigió **solo el entorno temporal** con un marcador sin
clave real y conectividad externa bloqueada.

El segundo intento completó las comprobaciones de aplicación a las 11:37:40:
**49,28 segundos** para el recorrido automatizado exitoso, incluyendo preparación,
verificación del respaldo ya disponible, descifrado, transmisión, restauración,
arranque, sesión y consultas. Ese valor excluye la eliminación final de recursos.

La práctica técnica completa, desde el primer intento hasta la verificación
productiva final de las 11:38:40,041, tardó **235,639 segundos: 3 min 55,639 s**.
Incluye el fallo, diagnóstico, ajuste, repetición y limpieza. No incluye el
tiempo previo de preparación del procedimiento ni la descarga periódica ya
completada; no se suma el tiempo de esta conversación como si fuera una caída.

## Práctica con Lina y condiciones permanentes

Andre confirmó que Lina estaba presente. El equipo confirmó que ella avisaría
a Andre y seguiría anotando en el Excel habitual, que encontró un comprobante
existente desde su cuenta y verificó importe/método, y que localizó la carpeta
de respaldo con sus tres archivos sin editarlos ni compartirlos. Se explicó
no repetir un cobro incierto antes de revisar su resultado.

Fue una **práctica asistida**: la restauración técnica la ejecutó la herramienta
bajo coordinación de Andre. No acredita que Lina administre PostgreSQL/SSH
autónomamente. El recorrido para el puesto está en la
[guía operativa](CLINIC_RECOVERY_OPERATOR_GUIDE.md).

La copia externa depende del computador encendido, conectado y con sesión
abierta. Las frecuencias dejan un margen nominal de hasta unos 45 minutos más
ejecución; una tarea fallida o un computador indisponible pueden incumplir el
RPO. El runner rechaza respaldos de más de una hora, pero no crea disponibilidad
permanente del equipo ni sustituye vigilar fecha y resultado.

Evidencia técnica privada en `.cache/recovery-application-20261027-result.json`
y en `/var/lib/mateos-pet-ai/recovery-drills/` de la VPS, excluida de Git.
La retención del respaldo continúa en 14 días; no se borraron copias anteriores.
El cierre no requiere migración, nueva versión ni despliegue de la aplicación.
