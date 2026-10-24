# Dinero base visible al cobrar

24/10/2026. Ajuste de interfaz solicitado por el responsable.

1. Función: mostrar y permitir confirmar/actualizar la base de la jornada desde
   el panel de pago, encima del total. No suma el importe a la venta ni al efectivo
   recibido del cliente.
2. Casos: venta de mostrador y cobro de cita; base registrada o sugerida desde el
   cierre anterior; jornada cerrada de solo lectura; permisos administrativos
   existentes; comprobación del guardado cuando se pierde la respuesta.
3. Arquitectura: reutilizar CashOpeningPanel y su endpoint autenticado. Agregar
   presentación compacta sin formulario anidado: Enter en su campo guarda solo
   la base; su botón no envía el cobro. Caja diaria conserva su formulario.
4. Persistencia: misma base por establecimiento y fecha de Colombia de la jornada
   actual, independiente de la fecha de la cita. Sin nuevo registro ni regla.
5. Esquema/validación: sin migración. Mantener contrato y permisos del endpoint;
   comprobar aislamiento de formularios, estados guardado/cerrado/sugerido y
   regresiones de POS, lint y compilación antes de publicar.

## Evidencia local

- `node --test scripts/pos-cash-opening-panel.test.cjs scripts/pos-catalog-search.test.cjs scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs`:
  `tests 32`, `pass 32`, `fail 0`. Las pruebas del panel usan dependencias
  simuladas: comprueban el render sin formulario anidado, Enter aislado del
  cobro, PUT a la misma base/establecimiento/fecha, base 0, permisos, jornada
  cerrada, bloqueo de controles y validación de importes.
- `npm run lint` en `frontend/`: `eslint`, salida 0.
- `npm run build` en `frontend/`: `Compiled successfully`, TypeScript correcto,
  `Generating static pages (32/32)`, salida 0. Se corrigió durante esta
  verificación el tipo nullable del establecimiento al pasar la propiedad.
- Revisión visual en navegador pendiente: su uso está deshabilitado en esta
  sesión. No se guardó ni alteró ninguna base, venta o pago real.
- Preparado localmente; sin commit, push ni despliegue de este lote.
