FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/orchestrator-api/package*.json ./apps/orchestrator-api/

RUN npm install

# Copiar fuentes y compilar
COPY packages/shared ./packages/shared
COPY apps/orchestrator-api ./apps/orchestrator-api

WORKDIR /app/packages/shared
RUN npm run build || true

WORKDIR /app/apps/orchestrator-api
RUN npm run build || true

# Imagen de producción ligera
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

WORKDIR /app/apps/orchestrator-api

EXPOSE 3000

CMD ["node", "dist/index.js"]
