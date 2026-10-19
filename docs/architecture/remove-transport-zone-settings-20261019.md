# Retirar zonas del catálogo de servicios

1. Funcional: retirar de Configuración el bloque Domicilios de peluquería con Nueva zona y su editor/listado, según el pedido del usuario. Servicio y domicilio se manejan desde mascota/cita.
2. Casos de uso: administrar el catálogo de servicios sin configuración adicional de zonas; conservar los valores individuales de mascota y cita.
3. Arquitectura: retirar el componente GroomingTransportZones y su estado exclusivo del catálogo. Mantener protección de borrador y guardado del editor de servicios. Ajustar el ensayo existente para preparar su zona histórica por API en datos desechables.
4. Persistencia: no borrar zonas ni datos previos ni cambiar la resolución de precios o contratos del backend. La compatibilidad de registros históricos permanece.
5. Esquema y validación: sin migración. Lint y build del frontend, ensayo existente de servicios/ficha/agenda/Caja en Chrome y PostgreSQL desechable y revisión de referencias al componente eliminado.

Decisiones diferidas: retirar contratos backend y tablas de zonas requeriría un alcance distinto, con revisión de datos y consumidores. Este pedido elimina la interfaz de configuración. Sin publicación del lote.

## Verificación ejecutada

19 de octubre de 2026. ESLint de `service-catalog.tsx`: exit_code 0. Build aislado `NEXT_VERIFY_BUILD=1 next build`: exit_code 0, TypeScript y 32 páginas correctos. Búsqueda completa en frontend: cero referencias al componente eliminado, Nueva zona, Zonas de domicilio y su estado exclusivo. `git diff --check`: exit_code 0.

El ensayo existente `verify-onboarding-local.cjs --grooming-transport` informó `Onboarding integration: 35 passed, 0 failed` y `PASS own temporary PostgreSQL container removed`. Conservó creación de servicios sin duración/precio fijos, valores de mascota/cita, intervalo de peluquería de 20 minutos, reprogramación, cobro único, inventario y comisión. Su zona de prueba se prepara por la API autenticada para mantener cobertura de compatibilidad histórica; el editor retirado ya no interviene. Sigue el aviso previo del reactor EventDelivery documentado en el lote financiero.

Sin cambios backend/schema ni datos reales editados. Producción sigue en 2.49.0; el lote local candidato 2.50.0 conserva sus seis migraciones anteriores pendientes de publicación. Sin commit/push/despliegue.
