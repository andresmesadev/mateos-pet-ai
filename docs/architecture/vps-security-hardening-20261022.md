# Endurecimiento y actualización preventiva de VPS — 22/10/2026

## 1. Definición funcional

El responsable solicita revisar seguridad y aplicar actualizaciones tras noticias
de vulnerabilidades. No comunica una intrusión ni un aviso concreto del sistema.
La revisión comprueba host, exposición, accesos, TLS, dependencias y runtime.
No incorpora reglas del negocio ni modifica datos clínicos o financieros.

## 2. Acciones y límites

- Cerrar acceso público directo a backend/frontend: únicamente Nginx recibe
  tráfico web público y los puertos Docker se publican en 127.0.0.1.
- Sustituir Node 24.21.0 de contenedores por la versión corregida 24.22.1.
  Next.js 16.4.2 ya está publicado. Auditar dependencias de producción.
- Restringir permisos del archivo de entorno, deshabilitar SSH root, reducir
  intentos/tiempo de autenticación y deshabilitar X11; conservar acceso ubuntu
  por clave verificado antes y después. TLS mínimo 1.2 y ocultar versión Nginx.
- Aplicar actualizaciones disponibles del repositorio oficial tras respaldo.
  Conservar PostgreSQL, pausas de WhatsApp y hechos de negocio.

## 3. Arquitectura técnica

Docker Compose conserva la red interna backend:3000 para el frontend. Nginx
continúa accediendo al host por loopback. No se usa UFW como sustituto de la
protección de puertos Docker; conservar las reglas existentes de iptables.
Los cambios del host se respaldan antes de aplicar, se validan con sshd -t y
nginx -t, y se comprueba una nueva conexión SSH antes de cerrar la sesión.
Dockerfiles fijan la versión de Node; CI y un despliegue con imágenes renovadas
verifican runtime real. Observación anterior se conserva íntegra.

## 4. Persistencia

Sin migraciones ni escrituras de negocio. Respaldo cifrado comprobado y copias
privadas de configuración, reglas de firewall y permisos para recuperación.
Evidencia pública solo agregada; no se incluyen secretos, claves, direcciones
de visitantes ni adjuntos. Se comparan huellas del inventario/cierre histórico.

## 5. Validación y publicación

Sonda externa dirigida antes/después, Docker Compose, SSH nuevo, TLS,
auditoría npm, CI, salud HTTPS y pantallas autenticadas. Comprobar versión Node
dentro de ambos contenedores y PostgreSQL conservado. Patch de aplicación
2.55.1 por endurecimiento y runtime, sin cambio de precios o comisiones.

## Decisiones arquitectónicas diferidas

Ubuntu 20.04 ya no recibe soporte estándar y este host carece de Ubuntu Pro:
su herramienta informa 174 actualizaciones de seguridad pendientes por ESM.
Actualizar los nueve paquetes del repositorio estándar no resuelve ese déficit.
La migración de versión mayor requiere un plan de recuperación y mantenimiento;
activar ESM requiere una cuenta/licencia del responsable. No se conecta una
suscripción ni se cambia de distribución silenciosamente. Docker Engine también
está limitado por el repositorio de Focal; no mezclar paquetes de otra Ubuntu.
