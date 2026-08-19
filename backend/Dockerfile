FROM node:20-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

# Prisma CLI + schema (monorepo root)
COPY package.json package-lock.json prisma.config.ts /app/
COPY prisma /app/prisma

WORKDIR /app
RUN npm ci --only=production

# prisma generate solo necesita que DATABASE_URL exista para cargar prisma.config.ts,
# no se conecta a la base de datos real. El valor real llega en runtime vía Render.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

WORKDIR /app/backend
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
EXPOSE 3000
CMD ["npm", "start"]
