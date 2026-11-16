FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/orchestrator-worker/package*.json ./apps/orchestrator-worker/

RUN npm install

# Copiar fuentes y compilar
COPY packages/shared ./packages/shared
COPY apps/orchestrator-worker ./apps/orchestrator-worker

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/apps/orchestrator-worker
RUN npm run build

# Imagen de producción endurecida
FROM node:20-alpine AS runner

RUN apk add --no-cache tzdata

WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Argentina/Buenos_Aires

COPY --from=builder /app ./

RUN chown -R node:node /app

WORKDIR /app/apps/orchestrator-worker

USER node

CMD ["node", "dist/index.js"]
