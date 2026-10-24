# Verificación — precio pendiente fuera de peluquería

24/10/2026. Implementación local de [ADR 030](../decisions/030-precio-diferido-servicios-no-peluqueria.md).
Verificación previa a publicar; producción en este corte continúa en 2.55.2.
El responsable autorizó despliegue posteriormente en esta sesión. El lote se
versiona 2.56.0 por la nueva separación entre finalizar atención y valorar en
Caja fuera de peluquería. Sin migración ni corrección manual de datos reales.
La publicación y sus comprobaciones se documentarán por separado.

## Comportamiento

- Finalizar peluquería mantiene sus precondiciones de precio y domicilio.
- Vacunación, consulta y otros servicios usan su tarifa, incluido cero explícito.
  El valor habitual de peluquería de la mascota no se usa en otras áreas.
- Cuando falta precio, Agenda completa la atención, ofrece Registrar pago y
  conserva precio null. No crea obligación ni comisión por cero.
- Caja abre el servicio principal con precio vacío. Confirmar exige importe,
  valida el propietario/mascota/establecimiento y crea un único cobro con sus
  artículos. Se fija el precio principal de esa atención sin cambiar tarifas
  habituales. Comisión, stock y pago se confirman o revierten juntos.
- La comisión diferida respeta el reparto del servicio y el contrato del
  profesional, usa la fecha de valoración y se publica tras el commit.
  Se conservan los gates de día y profesional y la restricción por liquidación.
- Reintentar la operación recupera el mismo recibo; una segunda clave después
  del pago es rechazada. Una atención sin valorar impide un cierre incompleto.

## Evidencia local

Comandos ejecutados:

```text
cd backend
node node_modules/jest/bin/jest.js --maxWorkers=2 --silent --json --outputFile=../.cache/deferred-price-jest.json
Test Suites: 219 passed, 219 total
Tests:       1842 passed, 1842 total
```

```text
node --test scripts/appointment-price-policy.test.cjs scripts/pos-checkout.test.cjs scripts/agenda-display.test.cjs
tests 16
pass 16
fail 0
```

ESLint de los seis módulos frontend modificados: exit 0. Build de Next.js y
TypeScript: exit 0, 32 rutas generadas. Revisión de diff y enlaces documentales
sin errores. Búsqueda completa de consumidores del resolver: los simuladores de
tarifa en ficha y creación de mascota ahora declaran explícitamente grooming;
sus 32 regresiones pasan. No se modificó el motor conversacional.

Las pruebas nuevas cubren completar/volver a leer bajo lock, categoría frente a
tipo heredado, precio nulo frente a cero, checkout y reactivos, reintento,
reparto y reversión ante stock, cierre o liquidación. La integración de checkout
usa comandos reales y un adaptador transaccional en memoria: **no certifica la
concurrencia de PostgreSQL**. Docker local no estaba ejecutándose, por lo que
no se ejecutó ese ensayo ni se conectaron pruebas a producción. Tampoco se
certifica una revisión visual de navegador en esta sesión.

## Bloqueo de seguridad resuelto antes del despliegue

El primer CI del lote (commit `00fcf87`) detuvo el job test en npm audit,
antes de ejecutar Jest: `body-parser@2.3.0`, dependencia transitiva de Express,
estaba afectado por [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)
(aviso publicado el 22/10 y actualizado el 23/10). Los otros cuatro jobs pasaron.
Se actualizó dentro del rango compatible a body-parser 2.4.0, con sus mínimos
transitivos iconv-lite 0.7.3 y qs 6.16.1; Express permanece en 5.2.1.
`npm --prefix backend audit --omit=dev --audit-level=high`: found 0 vulnerabilities.
El cambio de dependencias se valida de nuevo antes de publicar. No se ejecutó
la carga de prueba del aviso contra producción.
