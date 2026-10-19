# Formulario de la ficha de mascota reorganizado

17 de octubre de 2026. [Diseño y cinco etapas](../architecture/pet-profile-visual-20261017.md). Continuación visual de la ficha del propietario con frontend-design y los componentes y tokens existentes.

Identificación, Peluquería y domicilio y Datos clínicos conservan ese orden. Los campos se alinean en dos columnas en escritorio y una en móvil, con controles de 44 px. Notas ocupa todo el ancho y Guardar ficha/Cancelar tienen acciones claras al final. Los precios conservan su guardado separado y explícito; no cambia el cálculo de tarifas, Caja o comisiones.

El ensayo detectó un fallo previo: vaciar Notas enviaba null pero el servicio lo convertía en undefined y conservaba el texto anterior. La corrección se limita a ese campo: null borra, omisión conserva y texto guarda. Tres pruebas unitarias cubren estos casos.

```text
ESLint pet-medical-sheet.tsx y pet-grooming-prices.tsx: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
Backend Jest completo:
Test Suites: 206 passed, 206 total
Tests:       1682 passed, 1682 total
Time:        48.67 s
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 34 passed, 0 failed
  PASS own temporary PostgreSQL container removed
git diff --check: exit_code 0
```

Chrome/NextAuth/proxy/PostgreSQL comprobaron guardado y reapertura de raza, sexo, nacimiento, peso, esterilización y notas; borrado de notas; protección de borrador con Escape; conservación de los precios separados. Las anchuras 320/390/768/1440 no desbordaron horizontalmente. También se mantuvo el recorrido de agenda, pago único con adicionales, inventario y comisión del peluquero.

Capturas revisadas en `.cache/onboarding-verification/`: `31-pet-profile-identification.png`, `32-pet-profile-clinical.png` y `33-pet-profile-mobile.png`. La superficie, etiquetas y espaciado mantienen la identidad del dashboard; móvil conserva los botones dentro del ancho disponible.

Las 59 migraciones se aplicaron desde cero en PostgreSQL desechable. Sin nueva migración ni fichas reales modificadas. Sigue el aviso previo del reactor `EventDelivery_domainEventId_fkey`, documentado en verificaciones anteriores, fuera de este ajuste.

Sin commit/push/despliegue ni VPS modificada. Producción y versión declarada siguen en 2.49.0; lote local candidato 2.50.0, con seis migraciones anteriores pendientes de publicación.
