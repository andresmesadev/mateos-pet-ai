# Despliegue fijo en Render

Guía paso a paso para desplegar backend y frontend en URLs públicas fijas, reemplazando el túnel local (ngrok/cloudflared) que se rompe cada vez que la máquina se suspende.

`render.yaml` (raíz del repo) ya define ambos servicios. Render lo detecta automáticamente al conectar el repositorio ("Blueprint").

## Orden de los pasos (importante — hay dependencia circular)

Backend y frontend necesitan la URL público *del otro* como variable de entorno. Como ninguna existe todavía, el proceso es en dos pasadas:

### Paso 1 — Conectar el repo y crear el Blueprint

1. En [dashboard.render.com](https://dashboard.render.com), **New > Blueprint**.
2. Conecta el repositorio de GitHub `mateos-pet-ai`.
3. Render detecta `render.yaml` y propone los dos servicios (`mateos-pet-backend`, `mateos-pet-frontend`). Confírmalo.
4. El primer deploy va a fallar o quedar incompleto porque faltan las variables — es esperado, se resuelve en el paso 3.

### Paso 2 — Generar un secreto compartido

`INTERNAL_API_SECRET` debe ser **exactamente el mismo valor** en backend y frontend (es el secreto que el proxy del frontend usa para autenticarse contra el backend). Genera un valor aleatorio una sola vez (ej. `openssl rand -hex 32` o cualquier generador de contraseñas largas) y guárdalo para pegarlo en ambos servicios en el paso siguiente.

### Paso 3 — Completar las variables de entorno

En Render, cada servicio tiene su propia pestaña **Environment**. Completa:

**`mateos-pet-backend`:**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | El mismo que ya usas (el de la raíz `.env`, el que sí funciona) |
| `INTERNAL_API_SECRET` | El secreto generado en el paso 2 |
| `FRONTEND_URL` | La URL que Render le asignó a `mateos-pet-frontend` (algo como `https://mateos-pet-frontend.onrender.com`) — visible en la pestaña del servicio frontend después del primer deploy |
| `OPENAI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Los mismos valores que ya tienes en `backend/.env` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO` | Solo si ya facturas — si no, déjalas vacías por ahora |
| `SENTRY_DSN` | El mismo que ya tienes |
| `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Solo si usas la integración con Google Calendar |

**`mateos-pet-frontend`:**

| Variable | Valor |
|---|---|
| `API_URL` | La URL que Render le asignó a `mateos-pet-backend` (ej. `https://mateos-pet-backend.onrender.com`) |
| `NEXT_PUBLIC_API_URL` | La misma URL del backend |
| `NEXTAUTH_URL` | La URL del propio frontend (ej. `https://mateos-pet-frontend.onrender.com`) |
| `NEXT_PUBLIC_APP_URL` | La misma URL del propio frontend |
| `NEXTAUTH_SECRET` | Genera otro valor aleatorio distinto al de `INTERNAL_API_SECRET` (uso interno de NextAuth) |
| `INTERNAL_API_SECRET` | **El mismo exacto** que pusiste en el backend |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Las credenciales del único admin, las que ya usas |

### Paso 4 — Redeploy manual

Después de guardar las variables en ambos servicios, dispara un **Manual Deploy > Deploy latest commit** en cada uno (Render no redeploya solo por cambiar variables de entorno en el plan free). Espera a que los dos queden "Live".

### Paso 5 — Verificar

- Abre la URL del backend en el navegador — debe responder `Mateos Pet AI funcionando 🚀`.
- Abre la URL del frontend — debe cargar el login del dashboard.
- Entra con `ADMIN_EMAIL`/`ADMIN_PASSWORD` y confirma que el dashboard carga datos reales (no errores 500).

### Paso 6 — Registrar el webhook de WhatsApp, ahora fijo

En Meta for Developers, actualiza la Callback URL del webhook a:

```
https://mateos-pet-backend.onrender.com/webhook
```

(ajusta al nombre real que Render le haya dado). Esta URL ya no cambia — no hace falta repetir este paso cada vez que reinicies algo.

## Nota sobre el plan free de Render

El plan gratuito "duerme" el servicio tras ~15 minutos sin tráfico, y tarda unos segundos en despertar con la primera request después de eso. Para una prueba con pocos usuarios de confianza es aceptable — para Beta Cerrada real, conviene evaluar el plan pago (sin sleep) antes de invitar clientes.

## Migraciones de base de datos

`.github/workflows/deploy.yml` ya tiene un job que corre `npx prisma migrate deploy` — actívalo manualmente desde GitHub Actions (`workflow_dispatch`) cada vez que haya un cambio de schema, antes de que el backend nuevo lo necesite.
