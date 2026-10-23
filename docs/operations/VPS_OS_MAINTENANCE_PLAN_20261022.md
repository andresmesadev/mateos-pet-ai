# VPS: decisión de soporte y mantenimiento del sistema operativo

Revisión preventiva del 22/10/2026. Aplicación 2.55.0 al iniciar la revisión,
Node parcheado y cierre de exposición publicados como patch 2.55.1. El informe
de Ubuntu indica 174 actualizaciones de seguridad fuera de acceso sin ESM.
Los nueve paquetes del repositorio estándar ya se actualizaron; no equivale a
resolver ese déficit. Docker para Focal tampoco ofrece una versión posterior
a la instalada en el repositorio configurado.

## Ruta recomendada: Ubuntu 24.04 LTS compatible con Docker

1. Acordar interrupción operativa y comprobar acceso a consola de recuperación
   Oracle. Obtener snapshot/respaldo recuperable del volumen de arranque antes
   de una actualización mayor. El dump de PostgreSQL por sí solo no permite
   deshacer un cambio del sistema operativo.
2. Verificar respaldo cifrado, configuración privada, claves de recuperación,
   imágenes previas y espacio libre. Conservar checksum de datos y registros de
   operaciones; no restaurar una copia antigua sobre nuevas atenciones.
3. Elegir ruta con el responsable: instancia paralela 24.04 si existe capacidad
   disponible, probando restauración antes del corte; o actualización en sitio
   20.04 → 22.04 → 24.04 con consola y rollback de volumen disponibles. No saltar
   versiones ni mezclar repositorios de distintas distribuciones.
4. Conservar acceso por clave, reglas 22/80/443, loopback para aplicación,
   PostgreSQL privado, secretos con permisos 600 y certificados. Reinstalar o
   actualizar Docker desde el repositorio oficial de la versión destino.
5. Validar SSH desde una sesión nueva, arranque tras reiniciar, almacenamiento
   Docker/volúmenes, 65 migraciones, salud, autenticación, Caja, Agenda e
   inventario. Comparar datos y verificar backup/restauración y renovación TLS.
6. Conservar WhatsApp pausado y auditorías. Registrar la nueva observación de
   estabilidad sin convertir ventanas anteriores en una certificación.

## Alternativa temporal: Ubuntu Pro

El responsable debe disponer de cuenta/licencia aplicable y activar ESM mediante
un mecanismo local seguro; no enviar el token por el chat ni guardarlo en Git.
Después se simulan los parches ESM, se aplican con respaldo, se verifica si
requieren reinicio y se comprueba la cobertura. Esta alternativa no elimina la
necesidad de resolver el soporte de terceros como Docker.

## Estado y límites

**Completado el 23/10/2026**, después de iniciar sesión el responsable y
autorizar la consola temporal: actualización en sitio 20.04 → 22.04 →
24.04.5 LTS, Docker 29.9.2, respaldos de volumen disponibles, arranque y
firewall comprobados. Dashboard reabierto a las 12:16 Colombia. Consola y
clave temporales retiradas. No se necesitó Ubuntu Pro.

El [informe de ejecución](VPS_OS_MAINTENANCE_RESULT_20261023.md) contiene
resultados reales, respaldo de la base operativa, límite de la comparación
de huellas y nueva ventana de observación. No sustituye un ensayo de
restauración actual ni certifica 48 horas o seguridad absoluta.

Fuentes primarias: [soporte de Ubuntu](https://ubuntu.com/about/release-cycle),
[Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1).
