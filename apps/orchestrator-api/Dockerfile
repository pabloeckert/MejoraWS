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
RUN npm run build

WORKDIR /app/apps/orchestrator-api
RUN npm run build

# Imagen de producción endurecida
FROM node:20-alpine AS runner

RUN apk add --no-cache tzdata wget

WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Argentina/Buenos_Aires

COPY --from=builder /app ./

RUN mkdir -p /app/uploads && chown -R node:node /app

WORKDIR /app/apps/orchestrator-api

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/system/health || exit 1

CMD ["node", "dist/index.js"]
