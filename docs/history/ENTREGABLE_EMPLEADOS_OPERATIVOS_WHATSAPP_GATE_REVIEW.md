# Revisión local — empleados operativos por WhatsApp

Fecha: 2026-10-15. Implementación 2.48.0. **Revisión técnica propia y validación local completadas.** No equivale a revisión independiente ni aprobación de despliegue.

**Revisión posterior del mismo día:** la [revisión previa a publicación](EMPLEADOS_OPERATIVOS_REVISION_PREPUBLICACION_20261015.md) detectó cuatro ajustes adicionales. Fueron autorizados, [corregidos y comprobados localmente](EMPLEADOS_OPERATIVOS_AJUSTES_PREPUBLICACION_20261015.md): 195 suites/1.552 pruebas Jest, 73 pruebas PostgreSQL y 26 comprobaciones Node aprobadas. Las cifras de la matriz original conservan su evidencia histórica. CI está configurado; aún no se afirma ejecución remota ni certificación del canal real.

| Criterio aprobado | Implementación y evidencia |
| --- | --- |
| Cinco etapas aprobadas | [Esquema físico](../architecture/operational-employees-whatsapp-physical-schema.md); aprobación final explícita de implementación local |
| Tenant como única unidad de aislamiento | FKs compuestas, dueño canónico y pruebas de otro operador/establecimiento |
| Identidad administrativa real | Emisor privado, épocas separadas y prueba RPC; sin Staff ficticio |
| Staff con permisos actuales | Lectura de credencial/fuente bajo bloqueo; generaciones derivadas de cambios de fuente |
| Vinculación de dos extremos | Código HMAC, teléfono esperado, cinco intentos, prueba reciente y activación en dashboard |
| Conversación privada separada | `OperatorThread`/`OperatorMessage`; prueba con cero `User`/conversaciones de cliente creadas por la atención interna |
| Operaciones existentes | Reutiliza atención, Finanzas e Inventario; recibo único y transacción común |
| Confirmación inequívoca | Botón ofrecido por proveedor, mensaje correlacionado, revisión exacta, sesión y permisos; texto simple/reenviado rechazados |
| Recuperación sin repetición | UUID reservado, pasos durables, revisión atómica y recibo compartido entre canales |
| Entrega conservadora | Fence `sending` previo, auditoría y permisos antes del transporte; desconocido permanece incierto |
| Motor del cliente conservado | Parser/wrapper nuevos; no reescritura de los servicios conversacionales protegidos |
| Interfaz autenticada | `proxyUrl`, comprobación de Origin, reautenticación del mismo dueño y sin contraseña por WhatsApp |
| Versionado | Backend/lockfile 2.48.0; sin tag, commit ni publicación |

La [evidencia y límites](ENTREGABLE_EMPLEADOS_OPERATIVOS_WHATSAPP_COMPLETION_REPORT.md) registran comandos, resultados y captura visual: 193 suites/1.545 pruebas Jest, 69 pruebas PostgreSQL y 22 pruebas Node aprobadas; lint, build, Prisma y 52 migraciones sobre base vacía aprobados. El chequeo exhaustivo verificó el límite de Comunicación, los componentes autenticados, la ausencia de identidades ficticias, los servicios protegidos y el versionado. La revisión contra Plan Maestro, modelo conceptual y principios permanentes no identificó una contradicción que exija reconciliación arquitectónica.

**Dictamen: apto para cierre local dentro del alcance autorizado.** El canal queda deshabilitado por defecto. Commit/push, despliegue, secretos productivos, migraciones productivas y aceptación real de Meta siguen pendientes de autorización y verificación en su entorno.
