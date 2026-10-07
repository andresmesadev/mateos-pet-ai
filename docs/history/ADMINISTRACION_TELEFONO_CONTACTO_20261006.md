# Administración: teléfono de contacto independiente

Fecha: 2026-10-06. Implementado y verificado localmente.

## Resultado

En **Administración → Datos del negocio → Datos de contacto** hay un campo editable **Teléfono de contacto (opcional)**. Admite número local o con código de país y formatos con espacios, puntos, guiones y paréntesis. Guarda entre 7 y 15 dígitos y `+` inicial opcional; dejarlo vacío elimina el contacto configurado.

El identificador de WhatsApp se conserva protegido y aparece dentro de **Información del canal de WhatsApp**. Actualizar el contacto no cambia la recepción de mensajes.

## Persistencia y alcance

- Diseño previo: `docs/architecture/business-contact-phone-20261006.md`.
- `Tenant.contactPhone`, nullable, VARCHAR(16), sin unicidad; CHECK para el formato normalizado.
- Migración `20261006180000_business_contact_phone`, aditiva, aplicada únicamente a `127.0.0.1:5433/mateos_dev`. Los establecimientos existentes quedan con contacto null; no se copian identificadores técnicos como teléfonos.
- Prisma regenerado, versión 7.10.0.
- GET/PUT del perfil incluyen el contacto; el establecimiento se toma de la identidad autenticada, sin aceptar `tenantId` del body para escribir.
- No se modificaron motor conversacional, permisos, canales, precios ni comisiones. El contacto no se publica automáticamente en recibos o mensajes en este ajuste.

## Evidencia real

```text
prisma validate
The schema at prisma\schema.prisma is valid
exit_code: 0

prisma migrate deploy (base local comprobada antes de ejecutar)
44 migrations found in prisma/migrations
Applying migration `20261006180000_business_contact_phone`
All migrations have been successfully applied.
exit_code: 0

prisma generate
Generated Prisma Client (v7.10.0) to .\node_modules\@prisma\client in 549ms
exit_code: 0

frontend: npm run lint
> frontend@0.1.0 lint
> eslint
exit_code: 0

backend: Jest --runInBand
Test Suites: 5 passed, 5 total
Tests:       44 passed, 44 total
Time:        2.573 s
exit_code: 0

node --test scripts/business-contact-phone-postgres.test.cjs scripts/settings-navigation.test.cjs
PASS: perfil guardado y recargado, canal intacto, tenant ajeno intacto, omisión, vaciado y CHECK verificados.
tests 7
pass 7
fail 0
duration_ms 11683.0543
exit_code: 0

frontend: NEXT_VERIFY_BUILD=1 next build --webpack
Compiled successfully in 8.5s
Finished TypeScript in 6.2s
Generating static pages (29/29) in 2.9s
exit_code: 0

node scripts/verify-administration-local.cjs verify
PASS: nombre, teléfono de contacto, correo, descripción y dirección persistidos; identificador de WhatsApp conservado en PostgreSQL local.
exit_code: 0

node scripts/verify-administration-local.cjs cleanup
PASS: disposable tenant removed; existing business data unchanged.
exit_code: 0

node scripts/verify-administration-local.cjs cleanup-check
PASS: no queda ningún establecimiento temporal de esta comprobación.
exit_code: 0
```

Las cinco suites incluyen perfil administrativo, configuración, resolución de tenant y regresiones de WhatsApp para escalamiento y audio. El error de tasa de comisión en los logs es un caso negativo esperado de la suite existente, no un fallo.

La comprobación PostgreSQL crea dos establecimientos temporales, verifica que el body no altere el ajeno, omisión/vaciado, campos intactos ante validación fallida, restricción CHECK y contactos compartidos permitidos. Elimina sus fixtures al terminar.

## Interfaz comprobada

Se ejecutó el adaptador real con PostgreSQL local y el frontend compilado, en puertos temporales 3120/3121, restringidos al establecimiento de prueba y sin jobs ni envíos de mensajes.

- Campo de contacto vacío inicialmente, editable y con etiqueta/ayuda explícita.
- Guardado de número con formato: confirmación visible, lectura tras recarga y persistencia real en PostgreSQL.
- El identificador original permaneció `000000009940`, solo lectura.
- Número demasiado corto: mensaje de validación, borrador editable conservado; corregirlo permitió recuperar el estado sin cambios pendientes.
- Móvil a 375 px: documento 365 px y campo 283,2 px, sin desbordamiento horizontal. Se restauró el viewport.
- Se cerró la pestaña y se eliminó el establecimiento temporal. La señal Ctrl+C del PTY no cerró el helper en este host Windows; se identificaron sus dos procesos específicos y se utilizó limpieza explícita con verificación del marcador y ausencia de dependencias.

## Publicación

Cambios locales sin commit, push ni despliegue en esta tarea. La VPS aún necesita recibir la migración junto con la publicación del conjunto de mejoras de Administración. El versionado se evaluará antes del commit final de ese conjunto; no se creó un tag ni una versión oficial en esta ampliación.

Con este ajuste puede cerrarse **Datos del negocio** y continuar con **Áreas del negocio**.
