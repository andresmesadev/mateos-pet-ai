FROM node:24-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .

# Prisma CLI + schema (monorepo root)
COPY package.json package-lock.json prisma.config.ts /app/
COPY prisma /app/prisma

WORKDIR /app
RUN npm ci

# prisma generate solo necesita que DATABASE_URL exista para cargar prisma.config.ts,
# no se conecta a la base de datos real. El valor real llega en runtime vía docker-compose.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
# El cliente se genera junto al schema raíz. Se copia al node_modules del
# backend y luego se retira todo el toolchain raíz (incluido el CLI de Prisma),
# que no forma parte del runtime de producción.
RUN cp -R /app/node_modules/.prisma /app/backend/node_modules/.prisma \
    && rm -rf /app/node_modules

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
