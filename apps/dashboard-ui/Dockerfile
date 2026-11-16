FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/dashboard-ui/package*.json ./apps/dashboard-ui/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/dashboard-ui ./apps/dashboard-ui

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/apps/dashboard-ui
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/dashboard-ui/dist /usr/share/nginx/html
COPY apps/dashboard-ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
