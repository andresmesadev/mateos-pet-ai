# 2.55.1 — Corrección preventiva de seguridad

Solicitud autorizada del responsable el 22/10: revisar la VPS y actualizar lo
necesario por noticias de vulnerabilidades. No comunicó un ataque ni un aviso
propio. [Diseño y límites](../architecture/vps-security-hardening-20261022.md).

## Hallazgos comprobados

- Node 24.21.0 dentro de ambos contenedores; existe actualización de seguridad
  [24.22.1](https://nodejs.org/en/blog/release/v24.22.1).
- Backend: ip-address 10.7.2 transitivo de express-rate-limit, aviso moderado
  [CVE-2026-111997](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).
  Actualizado a 10.7.4 dentro del rango existente; no cambia la dependencia directa.
- 3000 accesible desde Internet. 3001 publicado en todas las interfaces aunque
  no respondió externamente; PostgreSQL y API Docker no respondieron a la sonda.
- SSH por clave y contraseña deshabilitada; siete días revisados: cero accesos
  exitosos por contraseña/root y una sola huella de clave aceptada, coincidente
  con authorized_keys. Miles de intentos con usuarios inválidos. No equivale a
  una auditoría forense ni descarta por completo una intrusión.
- Archivo de entorno frontend con permiso 664, TLS heredado en configuración
  global y SSH root por clave permitido: corregidos tras respaldo.
- Ubuntu 20.04 fuera de soporte estándar, sin Pro/ESM: 174 actualizaciones de
  seguridad indicadas por su herramienta. Nueve actualizaciones estándar
  aplicadas, pero el déficit ESM sigue pendiente. [Plan de resolución](../operations/VPS_OS_MAINTENANCE_PLAN_20261022.md).

## Correcciones

Dockerfiles fijan Node 24.22.1-alpine3.24. Docker Compose publica backend/frontend
solo en 127.0.0.1; la red interna se conserva. Nginx usa upstream IPv4 explícito.
SSH root deshabilitado, tres intentos, 30 segundos y X11 deshabilitado. Se
mantiene ubuntu por clave; conexión nueva probada. TLS mínimo 1.2, versión
Nginx oculta y permiso frontend 600. Firewall temporal DOCKER-USER bloqueó el
puerto externo de inmediato mientras se prepara el binding permanente.

Respaldo cifrado `mateos-pet-ai-20261022T232505Z`, SHA-256 correcto. Configuración
anterior y reglas guardadas privadamente en
`/var/lib/mateos-pet-ai/security-20261022T232505Z`. Validaciones sshd/nginx
correctas. Tras endurecimiento, solo 22/80/443 responden en los nueve puertos
sondeados y HTTPS conserva salud 2.55.0. No se reinició la VPS.

## Validación y publicación

Publicada el **22/10/2026 a las 18:36 Colombia**, commit funcional `e2fcebe`.

- Backend: 217 suites / 1822 tests aprobados; 166 pruebas auxiliares y ocho
  verificaciones del comprobador documental aprobadas. npm audit de producción
  en backend/frontend: `found 0 vulnerabilities` después del parche.
- [CI 39872173662](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/39872173662):
  cinco jobs aprobados (test, lint y tres recorridos PostgreSQL).
- Respaldo adicional de despliegue `mateos-pet-ai-20261022T233324Z`, cifrado y
  SHA-256 correcto. Imágenes 2.55.0 retenidas para recuperación; registro VPS
  `/var/lib/mateos-pet-ai/releases/2.55.1-20261022T233324Z`.
- Ambos contenedores ejecutan Node 24.22.1 y OpenSSL 3.5.9, comprobados dentro
  del runtime. ip-address 10.7.4 instalado. Salud HTTPS 200 / ok / 2.55.1,
  trabajador pausado, canal privado deshabilitado y cero reinicios de contenedor.
- Docker publica 3000/3001 únicamente en 127.0.0.1. Sonda externa: responden
  22/80/443; no responden 111/3000/3001/5432/2375/2376. TLS 1.0 y 1.1 rechazados
  por ambos dominios; TLS 1.2 y 1.3 aceptados. Contraseña/root SSH bloqueados,
  nueva conexión ubuntu por clave correcta y configuración sshd/nginx válida.
- Autenticación HTTPS y 14 pantallas correctas; contratos de Caja/inventario/
  servicios válidos; API anónima 401, parámetros ambiguos 400 y acciones de
  página no soportadas 405. No se realizaron operaciones de negocio de prueba.
- Mismo contenedor PostgreSQL, sin migraciones nuevas (65). Huellas de
  inventario y del cierre histórico idénticas antes/después. PostgreSQL 18.6
  coincide con la [versión menor soportada vigente](https://www.postgresql.org/support/versioning/).
- Observación anterior 2.55.0 conservada: 52 muestras, 4,25003 horas, cero fallos
  y cero huecos, incompleta para 48 horas. Nueva ventana
  `ventana-2.55.1-20261022T233613Z`, sin certificar todavía estabilidad completa.

Los cambios de configuración del host y sus copias están fuera de Git. No se
eliminaron auditorías, consumos o cierres para aplicar este parche. Para revertir
una imagen por una emergencia se conserva el binding local y el endurecimiento;
no se reabre el puerto público como parte de una reversión.

## Riesgo pendiente

No se declara la VPS completamente segura: falta resolver la cobertura del
sistema operativo y Docker. PHP/Java no se encontraron instalados en host ni
en los contenedores de la aplicación; la base de datos usada es PostgreSQL.
Una noticia sobre Oracle no demuestra que exista Oracle Database en esta VPS.
