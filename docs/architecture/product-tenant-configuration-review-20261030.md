# Separación de configuración por establecimiento: revisión del punto 4

**Alcance:** producto Huella Nex, 30/10/2026. Mateos Pet conserva su configuración
y datos reales. Los identificadores técnicos heredados no se renombran.

## Definición y casos de uso

Comprobar que un negocio nuevo no herede catálogos, precios, personal, contactos
o franjas de atención del primer establecimiento. Cada comprobante, expediente
impreso y respuesta sobre horarios debe usar la identidad/configuración del
negocio correspondiente, manteniendo separado su contacto público del identificador
técnico de WhatsApp.

La inscripción nueva parte con días cerrados y horas vacías, hasta que el
administrador habilite y guarde los suyos. Evita usar silenciosamente el fallback
histórico de 11–17. No se modifica ese fallback para establecimientos existentes
ni se retroactúa esta configuración sobre ellos.

En el comprobante se consulta la identidad actual mediante el proxy autenticado,
se exige que su ID coincida con el del cobro y no se habilita su botón de impresión
hasta comprobarla. La ficha PDF usa `contactPhone`, sin publicar el identificador
de conexión. Las respuestas de horarios se limitan a las áreas activas.

## Arquitectura, persistencia y esquema

Se reutilizan `Tenant.businessHours`, `Tenant.contactPhone`, configuración de
módulos, rutas de perfil y flujo existente de reserva/cobro. El cambio de horarios
es el estado inicial del aprovisionamiento de un negocio nuevo, dentro del
Contexto Negocio; no es una entidad nueva ni un rediseño del motor de disponibilidad.
Los horarios guardados continúan resolviéndose por área y luego por horario general.

La respuesta conversacional es una corrección de presentación en el adaptador:
consulta los módulos ya existentes, sin cambiar el algoritmo de reservas ni reglas
de comisiones. El 50% del fallback histórico y los identificadores de almacenamiento
se conservan por compatibilidad; contratos y servicios explícitos siguen gobernando
los repartos reales de cada tenant.

No se añaden tablas, migraciones ni snapshots financieros. El nombre/contacto del
comprobante son datos actuales del negocio, no un nuevo certificado de su identidad
histórica. No se convierten monedas/países: Colombia, COP y America/Bogota siguen
siendo el alcance operativo actual documentado.

## Validación prevista y decisiones diferidas

Pruebas aisladas de negocios con identidades y horarios distintos, bloqueo de
reserva antes de configurar, persistencia de horas propias, recibos/PDF/reportes
de su establecimiento y rechazo de una identidad ajena o no disponible. Mensajes
de horarios sin áreas desactivadas; cero llamadas a proveedores reales.

Cambios de identificadores técnicos, internacionalización, facturación electrónica
y snapshot histórico de datos del emisor quedan fuera. No se borra configuración
ni se modifica la operación productiva del primer cliente para pasar el ensayo.
