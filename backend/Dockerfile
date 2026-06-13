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
RUN npx prisma generate

WORKDIR /app/backend
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
EXPOSE 3000
CMD ["npm", "start"]
