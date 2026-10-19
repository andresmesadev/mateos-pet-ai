# Formulario de la ficha de mascota

1. **Funcional:** mejorar la organización visual de la ficha editable de mascota y su bloque de precios, manteniendo campos, permisos y guardados existentes.
2. **Casos de uso:** identificar la mascota y su propietario, consultar/editar peluquería y domicilio antes de los datos clínicos, registrar cuidados y guardar/cancelar sin perder borradores.
3. **Arquitectura/diseño:** solo `PetMedicalSheet` y `PetGroomingPrices`. Reutilizar Input/Button, tipografía Geist y paleta existente (`#f5f8f8`, `#ffffff`, `#1b353b`, `#137568`, `#dce8e5`), según frontend-design ya aplicada al propietario. Títulos en frase, iconos discretos, etiquetas uniformes, controles de 44 px, dos columnas en escritorio y una en móvil. Notas a todo el ancho y acciones alineadas al final. Mantener una superficie principal, destacando solo peluquería por su importancia en el pedido.
4. **Persistencia:** mismos campos y endpoints, con la corrección del borrado de notas descubierta en la verificación y reconciliada abajo. Precios y ficha conservan guardados separados y explícitos. No se añaden entidades, permisos ni cambios en tarifas/comisiones.
5. **Esquema y verificación:** sin migración. Lint/build, revisión de capturas y ensayo real de guardado/reapertura de datos clínicos/cuidados, precios, borrador y adaptación móvil; conservar regresiones de agenda y Caja.

Revisión previa del diseño: se mantiene el orden solicitado y la identidad del dashboard; se retiran etiquetas en mayúsculas, controles pequeños y el emparejamiento estrecho de notas con esterilización. No se rediseñan otras pantallas ni se añaden campos ajenos al pedido.

Reconciliación durante la verificación: el ensayo real detectó que `updatePet` ignoraba `notes: null`, de modo que vaciar Notas conservaba el texto previo. Se corrige solo ese campo nullable: null explícito borra y omisión conserva. No cambia permisos ni el resto de los datos clínicos. Se añaden regresiones y se repite Jest completo y el ensayo de navegador antes del cierre.
