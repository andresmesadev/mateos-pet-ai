FROM node:24.22.1-alpine3.24

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
