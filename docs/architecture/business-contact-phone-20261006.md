# Teléfono de contacto del establecimiento

Fecha: 2026-10-06. Alcance autorizado por el responsable: «ok aplicala por favor».

## Alcance y encaje

Ampliación del perfil existente en Administración, dentro de la identidad del Establecimiento (§1 del modelo de dominio). No agrega un entregable a la Fase 2, una fase futura, una entidad o un canal. La regla de las cinco aprobaciones de Fase 2 se limita explícitamente a los entregables de esa fase; no se extiende automáticamente a toda mejora. Se documenta el diseño antes de implementar esta ampliación autorizada.

## Definición funcional

El administrador puede guardar un teléfono de contacto del negocio. Cambiar ese número no cambia el identificador con el que se resuelve el establecimiento al recibir mensajes de WhatsApp.

## Casos de uso

- Consultar el perfil: devuelve el teléfono de contacto, inicialmente sin configurar.
- Actualizarlo: admite entre 7 y 15 dígitos, con `+` inicial opcional. Espacios, puntos, guiones y paréntesis son formato de presentación; se retiran al guardar.
- Vaciarlo: persiste `null`. Omitir el campo mantiene el dato anterior.
- Un dato inválido impide guardar todo el formulario y conserva el borrador.
- El establecimiento se obtiene de la identidad autenticada; body/query no escogen el registro a escribir. Se reutiliza la autorización administrativa existente.
- No envía mensajes ni cambia el canal. No introduce eventos de dominio nuevos.

## Arquitectura técnica

Se amplía el adaptador existente `tenant/profile`, su contrato TypeScript y el formulario GeneralInfoSection. El navegador continúa usando `proxyUrl`. `Tenant.phone` conserva su protección de solo lectura; `getTenantByPhone` y los consumidores de WhatsApp permanecen intactos.

### Decisiones arquitectónicas diferidas

Publicación en recibos, portal o mensajes, verificación telefónica y múltiples teléfonos no forman parte de este ajuste. No se infiere un país ni se conecta automáticamente este dato a WhatsApp.

## Persistencia

`Tenant.contactPhone` es un atributo opcional de la entidad existente. No es una clave ni necesita unicidad: dos establecimientos pueden compartir contacto. No se copian datos desde `Tenant.phone`, que puede contener un identificador de Meta.

## Esquema físico

Columna nullable `contactPhone VARCHAR(16)`; migración aditiva sin valor por defecto, backfill ni índices. Restricción CHECK: null o `^\+?[0-9]{7,15}$`. Conserva filas, claves y relaciones existentes. Se aplica a PostgreSQL local y se regenera Prisma; el despliegue de VPS queda para la publicación solicitada por el usuario.

## Validación prevista

API: normalización, vaciado, omisión, entradas inválidas, aislamiento, canal inmutable y proyección administrativa. PostgreSQL: migración, lectura tras guardar, CHECK y limpieza de fixtures. Interfaz: campo editable, guardado/recarga, error conserva borrador y canal de solo lectura. Lint, tests y build antes del cierre.
