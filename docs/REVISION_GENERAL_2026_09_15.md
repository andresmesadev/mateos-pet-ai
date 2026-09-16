# Revisión general de código, documentación y pruebas

Fecha: 2026-09-15. Commit revisado: `2e557f3`. Backend: `2.36.0`.

> Seguimiento: los hallazgos 1 y 2 se abordaron posteriormente en la corrección local `2.36.1`, documentada en [el informe de corrección](history/CORRECCION_COLA_ENTRANTE_2026_09_15.md). Los resultados de esta revisión describen el estado anterior y se conservan como evidencia histórica.

## Conclusión

La base automatizada está en verde: 988 pruebas pasan y el frontend compila, incluida la comprobación de TypeScript. El trabajo reciente de testing está incorporado y se reproduce localmente. Sin embargo, hay una brecha importante en la recuperación de mensajes de WhatsApp tras una caída del proceso, y las pruebas actuales no certifican el funcionamiento completo con PostgreSQL y proveedores reales.

Esta revisión combina inventario general, lectura de documentación y revisión focalizada de la cola entrante, autenticación por establecimiento, proxy del dashboard, configuración de pruebas y CI. No es una auditoría exhaustiva de cada archivo ni una validación de producción. No se modificó código funcional ni se ejecutaron migraciones.

## Qué se estaba probando

El commit `a054109`, del 14 de septiembre, añadió 224 pruebas para 13 servicios: tenant, historias médicas, mascotas, Stripe, construcción de contexto, persistencia de conversación, embeddings, memoria semántica, cola entrante, audio, imágenes, salud y usuarios. La suite pasó de 764 a 988 pruebas.

También incorporó `src/contexts/**/*.js` a la medición de cobertura. Los commits siguientes añadieron diagramas de arquitectura. Antes de ese bloque aparecen correcciones del respaldo ante fallos de transcripción, una dependencia circular de conversación y soporte de plantillas de WhatsApp.

## Evidencia ejecutada en esta revisión

### Backend

Comando:

```text
npm --prefix backend run test:coverage -- --runInBand --silent --coverageReporters=text-summary --coverageReporters=json-summary
```

Extracto real del resultado:

```text
Test Suites: 132 passed, 132 total
Tests:       988 passed, 988 total
Snapshots:   0 total
Time:        27.158 s, estimated 70 s
Statements   : 71.7% ( 4163/5806 )
Branches     : 56.65% ( 2018/3562 )
Functions    : 61.31% ( 577/941 )
Lines        : 72.19% ( 4022/5571 )
EXIT_CODE=0
```

Cobertura de líneas calculada desde `backend/coverage/coverage-summary.json`:

| Área incluida en Jest | Cobertura |
| --- | ---: |
| `src/services/` | 63,67 % |
| `src/contexts/` | 81,91 % |
| `src/lib/` | 80,48 % |

Estos porcentajes no representan todo el backend: `collectCoverageFrom` no incluye explícitamente rutas, controladores, middleware ni jobs. No hay umbral mínimo configurado. El backend tampoco declara un script de lint.

### Frontend

```text
npm --prefix frontend run lint
✖ 3 problems (0 errors, 3 warnings)
EXIT_CODE=0
```

Advertencias: `PAYMENT_METHOD_LABELS` sin uso en `frontend/components/dashboard/pos/sale-form.tsx:13`; `useCallback` y `Plus` sin uso en `frontend/components/dashboard/week-calendar.tsx:4-5`.

```text
npm --prefix frontend run build
✓ Compiled successfully in 4.6s
  Finished TypeScript in 6.2s ...
✓ Generating static pages using 11 workers (26/26) in 490ms
EXIT_CODE=0
```

## Hallazgos priorizados

### 1. Alta: un mensaje reclamado puede quedar bloqueado tras un crash

Evidencia: `backend/src/services/inbound-job.service.js:57-73` y `backend/src/jobs/inbound-message.job.js:105-117`.

El worker selecciona exclusivamente trabajos con estado `received` y los cambia a `claimed` antes de ejecutar el procesamiento. Si Node termina entre ese cambio y el marcado final, no se ejecuta el `catch` que devolvería el trabajo a la cola. En el siguiente arranque la consulta sigue ignorando `claimed`. El reenvío del mismo webhook tampoco crea otro trabajo, porque el encolado deduplica por proveedor e identificador.

Se buscó recuperación por `claimedAt`, estados obsoletos y referencias a la cola en el repositorio, sin encontrar un mecanismo de reclamación de trabajos abandonados. Es un defecto inferido directamente del flujo del código; no se provocó un crash en producción.

La afirmación de recuperación automática ante crash en `docs/history/ENTREGABLE_8_2_COMPLETION_REPORT.md:33` es más amplia que la implementación actual.

Siguiente validación necesaria: prueba de interrupción/reinicio sobre PostgreSQL de pruebas, seguida de un diseño de recuperación que considere efectos ya realizados. Reencolar ciegamente puede duplicar acciones o respuestas.

### 2. Media: los reintentos pueden agotarse dentro del mismo ciclo

Evidencia: `backend/src/services/inbound-job.service.js:82-104` y `backend/src/jobs/inbound-message.job.js:123-134`.

El servicio devuelve inmediatamente el trabajo fallido a `received`. El bucle del worker vuelve a reclamar trabajos hasta 50 veces, ordenados por fecha de creación. Por tanto, un trabajo antiguo puede consumir sus cinco intentos en el mismo ciclo si el error es rápido. El comentario que atribuye una espera natural al siguiente cron no coincide con ese comportamiento.

Impacto: una indisponibilidad breve puede terminar el trabajo antes de que el servicio externo se recupere. Falta una prueba que combine la devolución a `received` con el drenado real de la cola y compruebe el tiempo entre intentos.

### 3. Media: pruebas verdes con límites de integración relevantes

`backend/jest.setup.js` sustituye Prisma y OpenAI por mocks. Las pruebas de la cola y su worker también simulan dependencias. Esto permite comprobar decisiones y contratos, pero no demuestra bloqueos reales de PostgreSQL, recuperación después de reinicio ni entrega real a Meta.

La ejecución emitió además errores de certificación de eventos por métodos ausentes en mocks, como `findUnique`, `findMany` y `create`, mientras las pruebas pasaban. No prueban un fallo de producción, pero indican que algunas pruebas de integración no validan esos efectos secundarios. Conviene completar los mocks y las aserciones correspondientes, distinguiendo errores esperados de ruido accidental.

Áreas con cobertura de líneas baja: Google Calendar 20,53 %, recordatorios 25,35 %, citas 43,85 % y memoria 48,71 %. El siguiente esfuerzo debería priorizar escenarios de fallo y efectos de negocio, además del porcentaje.

### 4. Media: falta protección automatizada del frontend y del build en CI

`frontend/package.json` no declara pruebas y el inventario no encontró archivos de pruebas del frontend. `.github/workflows/ci.yml` ejecuta Jest del backend y lint del frontend, pero no el build/TypeScript del frontend ni un umbral de cobertura. El build sí figura en el workflow separado de despliegue.

El build local pasó hoy. La brecha es que un cambio futuro podría pasar el CI de una PR sin compilar o sin comprobar los flujos de interfaz.

### 5. Baja: documentación y comentarios desalineados

- `docs/PLAN_MAESTRO.md:510` conserva la Fase 8 como «En curso», aunque registra entregables completados y el trabajo posterior 8.4. Hace falta distinguir claramente cierre del roadmap y estado formal de la fase.
- Las instrucciones generales mantienen una sección histórica de Fase 5 titulada «En curso» junto a declaraciones de cierre.
- `backend/src/middleware/resolveTenant.js` todavía dice en su cabecera que `SINGLE_TENANT_ID` omite el token. El código y el comentario de la corrección posterior exigen el token fuera de tests. La implementación es más segura que esa descripción antigua.
- El informe de 8.2 debe acotar su afirmación de recuperación hasta resolver el hallazgo 1.

## Aspectos sólidos observados

- Separación explícita entre contextos de negocio, servicios heredados y adaptadores.
- El proxy del dashboard obtiene identidad y privilegios de la sesión; la selección de otro establecimiento se restringe al superadministrador.
- `resolveTenant` exige el secreto interno fuera de tests, incluso en modo de un establecimiento, y falla cerrado si falta configuración.
- El envío directo de texto a WhatsApp aparece encapsulado en el proveedor de Comunicación dentro del código funcional revisado.
- Existen pruebas de aislamiento, autorización, reservas y reglas financieras, además de las nuevas pruebas de servicios.

## Orden recomendado para continuar el testing

1. Reproducir en entorno aislado el trabajo `claimed` abandonado y los cinco intentos inmediatos; abordar recuperación e idempotencia con diseño explícito.
2. Añadir integración real con PostgreSQL de pruebas para cola, conflictos de reserva y operaciones financieras atómicas.
3. Eliminar errores accidentales de mocks y verificar certificación de eventos en los caminos relevantes.
4. Incorporar build/TypeScript al CI y pruebas de los flujos principales del frontend.
5. Reconciliar documentación de estado y garantías con lo realmente validado.

No se comprobó la versión desplegada, la base real, la configuración del VPS ni la operación de WhatsApp, Stripe o Google Calendar. Los resultados anteriores describen el checkout local y sus pruebas automatizadas.
