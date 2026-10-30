# Adopción de Huella Nex — 28 de octubre de 2026

Andrés eligió el nombre **Huella Nex**, el logo **02, Vínculo**, y autorizó
aplicarlos al software.
Público: veterinarias, pet shops y peluquerías caninas y felinas. Descriptor:
«Gestión para negocios de mascotas». Nexo Web sigue siendo su iniciativa de
desarrollo sin constituir; Mateos Pet sigue siendo el centro donde se utiliza.

## Alcance de presentación

- Componente de marca compartido y recurso PNG del símbolo aprobado, con
  perfiles de perro y gato. Wordmark como texto accesible, sin recortar la lámina.
- Página pública, login/registro, menú de escritorio/móvil, recuperación de
  sesión, títulos/metadatos, suscripción, mensajes de importación y créditos
  de exportación PDF/Excel. Iconos de navegador y Apple derivados mediante
  las convenciones de metadatos de Next.js; se retira el favicon de plantilla.
- Lenguaje de producto abarca los tres tipos de negocio; no se cambia la
  navegación, la autorización ni los flujos de la operación.

## Dominio, persistencia y compatibilidad

Es mantenimiento de identidad en los adaptadores; no un entregable nuevo de
dominio. No se añaden entidades, casos de uso, eventos, modelos o migraciones.
Se conservan precios, comisiones, autenticación y aislamiento por Tenant.

No se sustituyen globalmente cadenas técnicas `mateos-*`: repositorio,
contenedores/volúmenes, servicios/timers, base, rutas de respaldo, secretos y
claves de almacenamiento siguen compatibles. Las huellas financieras, los
nombres de los centros y sus mensajes de atención no son marca del producto.
Por solicitud expresa posterior de Andrés, los informes históricos y las
copias legales aprobadas también usan Huella Nex, incluidos los PDF 1.1 y 1.2
de la política del centro. Se identifica la edición de marca del 28/10 y se
conservan versiones, fechas y decisiones originales, sin nuevas aprobaciones.

## Versionado y publicación

Candidato patch **2.58.3**: presentación de marca, sin capacidad operativa nueva.
Implementación local; producción sigue en 2.58.2 mientras no se publique este
lote. No se reinicia la observación de estabilidad por preparar los archivos.
El cambio de marca no cierra el ítem 9 ni acredita disponibilidad registral de
marca o dominios. Su verificación registral y una eventual migración de
dominio quedan separadas de esta aplicación visual.

## Validación

- `npm run lint`: salida 0.
- `npm run build`: compilación y TypeScript correctos, incluidas las rutas
  estáticas `/icon` y `/apple-icon`. El primer intento no pudo descargar las
  fuentes ya existentes de Google; el reintento con red autorizada pasó.
- 35 pruebas pertinentes aprobadas: reportes/Excel, recuperación de sesión,
  continuidad de permisos y comprobador documental. Los fixtures se ajustaron
  al componente de marca nuevo; Excel se abre con creador «Huella Nex» y
  conserva cuatro hojas, cifras numéricas y protección frente a fórmulas.
- Dos suites/once pruebas de salud y worker aprobadas bajo versión 2.58.3.
- HTTP local de la aplicación compilada: inicio, login, registro y recuperación
  devuelven 200, marca nueva y recurso aprobado; metadatos de aplicación y
  Open Graph correctos. Iconos PNG de 32×32 y 180×180 devuelven 200, al igual
  que el recurso gráfico. No se afirman pruebas visuales en un navegador.
- Búsqueda completa del texto de marca en fuentes activas: no quedan
  la denominación ni el wordmark anteriores en frontend o backend ejecutable.
  Se conservan mensajes que identifican al centro Mateos Pet. El bootstrap
  local usa «Centro de demostración» como nombre nuevo, con el slug heredado
  intacto; no se ejecutó ni se renombraron datos de ningún centro existente.
- No se hicieron escrituras de negocio ni cambios en la VPS. Los informes
  históricos y las copias legales se actualizan editorialmente; los literales
  técnicos se mantienen por compatibilidad.

## Extensión documental solicitada el 28/10

Andrés autorizó expresamente actualizar también los informes históricos y
las copias legales ya aprobadas. Se cambió la denominación del software en
27 documentos públicos y 27 copias privadas, incluidos los textos de versiones
archivadas; no se cambiaron el nombre del centro, sus responsables, importes,
fechas ni decisiones originales. Las copias de correspondencia identifican
su edición y no se presentan como nuevos envíos. Las capturas originales y
los identificadores técnicos se conservan.

Se regeneraron desde su propia fuente las políticas PDF 1.1 y 1.2: tres páginas
cada una, marca Huella Nex, contactos completos y nota editorial del 28/10.
La revisión visual de las seis páginas no mostró recortes ni superposiciones.
El acta privada conserva la huella histórica del PDF 1.2 y registra la nueva;
no se atribuye a la aprobación original el archivo editado posteriormente.

Comprobador documental: 454 documentos, 435 Markdown y 1377 enlaces; sin enlaces
rotos ni errores de catálogo. Sus ocho pruebas pasan. La búsqueda del nombre
visible anterior no arroja coincidencias en documentos públicos o copias
legales privadas. Esta edición continúa local, pendiente de publicación.
