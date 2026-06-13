# Mateos Pet AI

Bot de WhatsApp con IA para **Mateos Pet** (veterinaria y peluquería canina).  
Agenda citas, responde consultas y recuerda contexto entre conversaciones.

**Stack:** Node.js · Express 5 · Prisma 7 · PostgreSQL (Neon) · pgvector · OpenAI · Next.js 16

---

## Requisitos

- **Node.js** 20+
- Cuenta **Neon** (PostgreSQL con extensión `vector`)
- Cuenta **Meta for Developers** (WhatsApp Cloud API)
- Cuenta **OpenAI** con API key
- **ngrok** (o túnel similar) para desarrollo local con webhook de Meta

---

## Estructura del repo

```
mateos-pet-ai/
├── backend/          # API Express + servicios WhatsApp / IA
├── frontend/         # Dashboard Next.js (admin)
├── prisma/           # Schema y migraciones (raíz del repo)
└── prisma.config.ts  # URL de DB para Prisma CLI
```

---

## 1. Variables de entorno

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` con tus credenciales reales.

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL (Neon) |
| `OPENAI_API_KEY` | API key de OpenAI |
| `WHATSAPP_VERIFY_TOKEN` | Token que defines tú para verificar el webhook |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número en Meta Developer Console |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente o temporal de la app Meta |
| `WHATSAPP_APP_SECRET` | App Secret de Meta (validación HMAC del webhook POST) |
| `PORT` | Puerto del backend (default `3000`) |

**`WHATSAPP_APP_SECRET`:** en [Meta for Developers](https://developers.facebook.com) → tu app → **App Dashboard** → **Configuración** → **Básica** → **App Secret** (clic en *Mostrar*). Es distinto del Access Token; se usa para validar `X-Hub-Signature-256` en cada POST al webhook.

**Prisma CLI:** las migraciones leen `DATABASE_URL` desde la **raíz** del repo. Puedes copiar la misma URL a un `.env` en la raíz o exportarla antes de migrar:

```bash
# Desde la raíz del repo
echo "DATABASE_URL=postgresql://..." > .env
```

---

## 2. Base de datos (Prisma)

Desde la **raíz** del repositorio:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

En desarrollo, para crear nuevas migraciones:

```bash
npx prisma migrate dev --name descripcion_cambio
```

Verifica la conexión:

```bash
npx prisma studio
```

---

## 3. Backend

```bash
cd backend
npm install
npm run dev
```

El servidor arranca en `http://localhost:3000`.

**Endpoints útiles:**

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/` | Health básico |
| GET/POST | `/webhook` | Webhook WhatsApp (Meta) |
| GET | `/api/health` | Health API |
| POST | `/api/test/analyze` | Probar flujo conversacional sin WhatsApp |
| GET | `/api/dashboard/stats` | Estadísticas para el dashboard |

---

## 4. Frontend (dashboard)

El backend usa el puerto **3000**. Next.js también usa 3000 por defecto, así que levanta el frontend en **3001**:

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

Abre `http://localhost:3001/dashboard`.

> El dashboard consume `http://localhost:3000/api/dashboard/stats`. Mantén el backend corriendo.

---

## 5. ngrok + WhatsApp (desarrollo local)

Meta necesita una URL pública HTTPS para el webhook.

### 5.1 Exponer el backend

Con el backend en el puerto 3000:

```bash
# Opción A — ngrok global
ngrok http 3000

# Opción B — desde dependencias del backend
cd backend
npx ngrok http 3000
```

Copia la URL HTTPS que muestra ngrok, por ejemplo:  
`https://abc123.ngrok-free.app`

### 5.2 Configurar Meta Developer Console

1. [developers.facebook.com](https://developers.facebook.com) → tu app → **WhatsApp** → **Configuration**
2. **Callback URL:** `https://abc123.ngrok-free.app/webhook`
3. **Verify token:** el mismo valor que `WHATSAPP_VERIFY_TOKEN` en `backend/.env`
4. Suscríbete al campo **messages**
5. En **API Setup**, copia **Phone number ID** y genera un **Access token** → `backend/.env`
6. En **App Dashboard → Configuración → Básica**, copia **App Secret** → `WHATSAPP_APP_SECRET` en `backend/.env`

Los POST al webhook (`/webhook` y `/api/webhook`) validan la firma `X-Hub-Signature-256` con ese secret. Sin él, Meta recibirá `401 Unauthorized`.

### 5.3 Probar

1. Backend corriendo (`npm run dev` en `backend/`)
2. ngrok activo apuntando al puerto 3000
3. Envía un mensaje de WhatsApp al número de prueba de Meta
4. Revisa logs en la terminal del backend: `[WhatsApp]`, `[Conversation]`, `[Scheduling]`

---

## 6. Probar sin WhatsApp

```bash
curl -X POST http://localhost:3000/api/test/analyze \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Hola, quiero una consulta veterinaria para Max\"}"
```

Respuesta JSON con `reply` y `session` (estado del wizard en memoria).

> Límite: **20 solicitudes/minuto por IP** en `/api/test`.

---

## 6.1 Health check (monitoreo)

Endpoint público (sin autenticación) para comprobar que el backend y sus dependencias responden:

```bash
curl http://localhost:3000/api/health
```

Ejemplo cuando todo está bien (`200`):

```json
{
  "status": "ok",
  "timestamp": "2026-06-13T12:00:00.000Z",
  "services": {
    "database": "ok",
    "openai": "ok"
  },
  "version": "1.1.0"
}
```

Si PostgreSQL u OpenAI fallan, el JSON incluye `"status": "degraded"` y el servicio afectado en `"error"`; la respuesta HTTP es **503**. Útil para uptime monitors, load balancers o scripts de alerta.

---

## 7. Scripts de referencia

| Ubicación | Comando | Descripción |
|-----------|---------|-------------|
| `backend/` | `npm run dev` | Backend con nodemon |
| `backend/` | `npm start` | Backend producción |
| `frontend/` | `npm run dev -- -p 3001` | Dashboard desarrollo |
| Raíz | `npx prisma migrate deploy` | Aplicar migraciones |
| Raíz | `npx prisma studio` | UI de base de datos |

---

## 8. Solución de problemas

| Problema | Qué revisar |
|----------|-------------|
| Webhook 403 | `WHATSAPP_VERIFY_TOKEN` coincide con Meta |
| No llegan mensajes | ngrok activo, callback `/webhook`, suscripción a `messages` |
| Error Prisma / DB | `DATABASE_URL` correcta, migraciones aplicadas, extensión `vector` en Neon |
| Webhook POST sin firma válida | Revisa `WHATSAPP_APP_SECRET` (App Dashboard → Configuración → Básica) |
| OpenAI falla | `OPENAI_API_KEY` válida y con crédito |
| Dashboard en 0 | Backend en `:3000`, PostgreSQL accesible |
| Health check degraded | Revisa `DATABASE_URL` y `OPENAI_API_KEY`; prueba `GET /api/health` |
| 429 Demasiadas solicitudes | Rate limit por IP: test 20/min, dashboard 60/min, webhook 100/min |
| Puerto ocupado | Cambia `PORT` en `backend/.env` y actualiza ngrok |

---

## Licencia

ISC · [Repositorio](https://github.com/andresmesadev/mateos-pet-ai)
