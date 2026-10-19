# Barrio del propietario y edición más clara

## 1. Definición funcional
Añadir Barrio opcional al contacto del propietario y mejorar la edición con tres grupos visuales: contacto, ubicación y notas. Mostrar barrio también al consultar la ficha y al registrar un propietario nuevo. Proponerlo en un traslado nuevo, preservando snapshots ya capturados en citas.

## 2. Casos de uso
Guardar/reabrir barrio, modificarlo o borrarlo; crear propietario con o sin barrio; consultar ubicación desde su mascota; iniciar domicilio con dirección/barrio del propietario. No extraer barrios automáticamente de direcciones importadas ni reescribir traslados existentes.

## 3. Arquitectura técnica y diseño visual
Ampliar los adaptadores actuales de Cliente y DTO de agenda/mascota; mantener proxy autenticado, Tenant, validación y permisos de notas. La propuesta del domicilio usa el barrio del propietario solo cuando aún no se ha configurado el traslado; un barrio deliberadamente vacío en traslado configurado se conserva.

Aplicar la guía frontend-design dentro del sistema existente: fondo `#f5f8f8`, superficie `#ffffff`, texto `#1b353b`, acento `#137568`, borde `#dce8e5`; familia Geist ya instalada, etiquetas de 14 px y subtítulos semibold. Una superficie principal con divisores, sin tres tarjetas repetidas. Dos columnas para contacto; dirección ocupa dos tercios y barrio un tercio cuando hay espacio. Alineación izquierda, foco visible, una columna móvil, notas con altura contenida y footer fijo existente.

```text
Contacto principal
Nombre                 Correo
Teléfono principal     Teléfono alternativo
──────────────────────────────────────────
Ubicación
Dirección                         Barrio
──────────────────────────────────────────
Notas del propietario
[texto completo editable con scroll]
```

Revisión del plan contra el pedido: conservar marca/tipografía, recortar bordes anidados y separar ubicación para que Barrio sea fácil de encontrar. No añadir animaciones, fuentes ni controles nuevos ajenos al formulario. Se mantiene todo visible, incluidos los datos opcionales.

## 4. Persistencia
`User.neighborhood` opcional, independiente de `address`; Cliente/Mascota ya están definidos en el modelo de dominio. `Appointment.transportNeighborhood` sigue siendo el snapshot de una atención. Escribir el contacto no modifica citas ni notas importadas.

## 5. Esquema físico y verificación
Columna nullable aditiva en User sin backfill; migración local y generación Prisma. Validar longitud/tipo antes de escribir, omisión conservadora, vacío como borrado y aislamiento. Jest, lint/build, navegador con edición/alta/consulta, borrador protegido y propuesta a traslado; capturas de escritorio y móvil.
