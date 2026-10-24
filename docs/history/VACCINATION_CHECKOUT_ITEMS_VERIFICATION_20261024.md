# Verificación local — vacunación sin cargo fijo impuesto

24/10/2026. Solicitud del responsable tras observar una línea Vacunación por
cero en un comprobante confirmado. Diseño en [ADR 031](../decisions/031-cobro-cita-por-articulos.md).
Verificación previa a publicación. El responsable autorizó después el despliegue
de este lote como **2.57.0**, por el cambio funcional del cargo principal opcional
fuera de peluquería. Producción en este corte continúa en 2.56.0. Sin migración
ni modificaciones de cobros, inventario o datos reales para realizar las pruebas.

## Resultado implementado

- Fuera de peluquería se propone el cargo principal solo si tiene precio
  positivo. Una vacunación sin tarifa abre Caja sin filas de servicio vacías.
- Es posible cobrar únicamente los productos del inventario. El equipo puede
  agregar un cargo por aplicación, editarlo o retirarlo antes de confirmar.
  Peluquería mantiene su servicio principal obligatorio y domicilio opcional.
- La obligatoriedad procede de la categoría real cargada por el servidor bajo
  lock de cita, no de flags enviados por el cliente. Los nombres no deciden
  cómo cobrar. El usuario/mascota, Tenant y permisos conservan sus validaciones.
- Checkout reutiliza una sola Transaction y la operación idempotente existente.
  Mantiene los snapshots de producto y sus cantidades. Productos solos no
  generan una comisión por el servicio principal; los servicios adicionales
  conservan su reparto independiente. Un cargo principal retirado anula su
  comisión anterior mediante ADR 009, sin reemplazo ni cambio de sus importes.
- Vaciar un carrito fuera de peluquería retira todos sus artículos. Los borradores
  inciertos y claves de pago existentes no se reescriben. Los comprobantes ya
  cobrados continúan en solo lectura y no se eliminaron líneas históricas.

## Comandos y evidencia

```text
cd backend
node node_modules/jest/bin/jest.js --maxWorkers=2 --silent --json --outputFile=../.cache/vaccination-items-jest.json
Test Suites: 219 passed, 219 total
Tests:       1850 passed, 1850 total
```

```text
node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs
tests 26
pass 26
fail 0
```

Frontend: `npm run lint`, exit 0. `npm run build`, exit 0: Next.js/TypeScript,
32 rutas generadas. El primer intento de compilación falló al descargar Geist
desde Google Fonts con la red restringida; se repitió con acceso autorizado,
sin cambiar el código ni sustituir fuentes. Revisión de diff sin errores y
búsqueda completa de las restricciones de componente principal realizada.

Casos nuevos: vacuna sola, producto más dos unidades de otro producto, snapshots,
precio principal conocido/cero/ausente, categoría sobre tipo heredado,
flag falsificado para retirar peluquería, cargo retirado sin comisión de reemplazo,
idempotencia y reversión al fallar stock. La integración usa los comandos reales
con un adaptador transaccional en memoria; no certifica concurrencia nueva en
PostgreSQL ni validación visual de navegador. No se usó producción como entorno
de pruebas.
