# Actualización de la VPS — 23 de octubre de 2026

La actualización autorizada se completó en la misma instancia. El dashboard
volvió a estar disponible a las **12:16:38 Colombia**. Mantenimiento explícito
desde las 11:30:01: **46 min 37 s**. Aplicación conservada en **2.55.1**, HEAD
`964efac`; sin reconstrucción de imágenes ni migraciones de aplicación.

## Resultado y comprobaciones

| Componente | Evidencia al terminar |
| --- | --- |
| Ubuntu | Ruta secuencial 20.04 → 22.04 → **24.04.5 LTS**; ambos actualizadores finalizaron con código 0. Arranque final comprobado, kernel `7.0.0-1013-oracle`. |
| Paquetes | `apt-get update` correcto; simulación final: **0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded**. `dpkg --audit` vacío; sin reinicio pendiente ni unidades fallidas. |
| Docker | **29.9.2**, containerd **2.4.2**, runc **1.5.2**, Compose **5.6.1**. Mismos contenedores, imágenes y volumen; almacenamiento overlay2 conservado. |
| Aplicación | Node **24.22.1**, OpenSSL **3.5.9**, salud HTTPS **200 / ok / 2.55.1**, worker entrante **paused**. Base operativa con **65 migraciones aplicadas**. |
| Datos y funciones | Lecturas autenticadas: apertura de caja, cierre histórico con importes desconocidos conservados, reportes conciliados con el libro de comisiones inmutable y servicios de Otros agendables: **PASS**, `businessWrites: 0`. |
| Navegador autenticado | Inicio, Agenda, Caja e Inventario cargaron con la sesión existente, sin modificar registros. Caja muestra base, cierre y resumen administrativo. |
| Red | Sondeo externo: 22/80/443 accesibles; 111/3000/3001/5432/2375/2376 inaccesibles. Backend/frontend publicados solo en 127.0.0.1. Reglas INPUT y DOCKER-USER persistieron tras reiniciar Docker y el host. |
| Acceso/TLS | SSH sin root ni contraseña; secretos en modo 600. Ambos dominios aceptan TLS 1.2/1.3 y rechazan 1.0/1.1. APIs sin sesión devuelven 401 y dashboard sin sesión redirige 307. |
| Servicios | PostgreSQL healthy; backend/frontend en ejecución, cero reinicios posteriores al arranque. Nginx/sshd validan configuración. Timers de respaldo y actualizaciones estándar activos. 121 GB disponibles, 38 % de ocupación. |

Ubuntu 24.04 dispone de mantenimiento estándar hasta mayo de 2029 según
[Canonical](https://ubuntu.com/about/release-cycle). El repositorio oficial de
Docker corresponde a Noble/arm64, configuración compatible con su
[documentación](https://docs.docker.com/engine/install/ubuntu/).
Esto resuelve la limitación de Focal del plan anterior; no acredita cobertura
universal de cualquier paquete ni ausencia absoluta de vulnerabilidades.

## Respaldo y alcance de la integridad

- Dos respaldos completos del volumen confirmados **AVAILABLE** en Oracle;
  el segundo, `nexoweb-consistent-pre-upgrade-20261023`, se obtuvo con la
  aplicación y PostgreSQL detenidos. Se conservaron configuraciones y datos
  en la misma VPS; no se restauró una copia antigua sobre la operación.
- Respaldo lógico cifrado de la **base operativa real**, con aplicación
  detenida: `20261023T163002Z`; SHA-256 comprobado. Nuevo respaldo cifrado
  posterior: `20261023T171854Z`, **515.885 bytes**, checksum correcto.
  El mecanismo hace pg_dump completo y valida su catálogo con pg_restore.
- **Límite detectado y comunicado:** la huella de 69 tablas comparada antes y
  después correspondía a la base histórica `mateos` (52 migraciones), no a
  la base operativa `mateos_dashboard_20261016` (65). Ambas huellas coincidieron,
  pero **no se presenta eso como comparación integral de los datos reales**.
  La conexión del respaldo lógico se obtuvo del DATABASE_URL de backend y
  sí corresponde a la base operativa. La verificación funcional posterior
  también usó esa conexión. Falta un ensayo aislado de restauración actual;
  no se lo declara completado con estas comprobaciones.
- No se exportó la base al PC: la revisión automática rechazó esa transferencia
  y se utilizó el respaldo del volumen en Oracle como alternativa. No se
  copiaron claves privadas al servidor ni se publicaron adjuntos/evidencias.
- La consola temporal autorizada se comprobó y luego se retiró: estado
  **DELETED** en Oracle, archivos de clave temporal eliminados en Cloud Shell.
  Archivo temporal de conexión PostgreSQL y override de mantenimiento de apt
  retirados del host. Configuraciones previas permanecen en directorio privado
  de recuperación, con permisos restringidos.

No se registraron pagos, cierres, historias clínicas ni consumos para probar.
Se respeta la decisión de no descontar retrospectivamente Vacuna puppy.
WhatsApp continúa pausado y el canal privado deshabilitado.
Lectura posterior: 22 productos, 40 movimientos, Vacuna puppy **11 unidades**;
el cierre histórico del 19/10 está presente. Son comprobaciones posteriores,
no una huella integral anterior/posterior de la base operativa.

## Continuidad de la beta

**Cambio posterior:** la publicación [2.55.2, a las 14:04](../history/RELEASE_2_55_2_VPS_20261023.md)
conservó la ventana del mantenimiento con 21 muestras sin fallos y creó otra.
La ventana descrita abajo corresponde al cierre de esta intervención; ya no
es la activa después de esa publicación.

La operación real iniciada el 19/10 conserva sus registros y aceptación.
La observación anterior `ventana-2.55.1-20261022T233613Z` se conserva:
**203 muestras, tres fallidas** por timeout de salud de 25 s, a las
08:01:14Z, 10:06:15Z y 15:01:19Z del 23/10, antes del mantenimiento.
No atribuirlas a esta intervención ni dar por resuelto su origen.

Nueva ventana tras cambiar sistema/runtime del host:
**`ventana-2.55.1-20261023T171725Z`**, iniciada a las **12:17:25 Colombia**.
Servicio activo y primera muestra correcta. Sus 48 horas se cumplirían el
**25/10 a las 12:17**, si completa sin fallos/huecos; requieren revisar el
resultado, no solo esperar la fecha. Los cortes anteriores no se suman como
continuidad certificada.

En los diez ítems de beta: el pendiente de actualización del host del ítem 3
queda resuelto; el ítem 5 gana respaldo de volumen y consola comprobados,
pero mantiene restauración aislada actual/suplente/RPO-RTO pendientes; el
ítem 9 sigue abierto. Capacidad, aceptación puntual de stock/base/reportes y
decisiones documentales conservan sus pendientes. No se reinicia la puesta
en marcha real ni se declara toda la beta cerrada.

## Validación documental

`node scripts/check-docs.cjs`: **418 documentos, 1.249 enlaces**, sin enlaces
rotos ni referencias faltantes. `node --test scripts/check-docs.test.cjs`:
**8 pruebas aprobadas, 0 fallidas**. `git diff --check`: sin errores de espacios.
Cambios exclusivamente documentales; sin commit, push, tag ni despliegue de
aplicación adicionales para esta actualización del sistema operativo.
