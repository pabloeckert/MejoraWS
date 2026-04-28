# ============================================
# MejoraWS — Makefile
# ============================================
# Uso: make <comando>
# ============================================

.PHONY: help dev build start stop restart logs backup clean

help: ## Mostrar ayuda
	@echo "╔═══════════════════════════════════════════╗"
	@echo "║        MejoraWS — Comandos                ║"
	@echo "╠═══════════════════════════════════════════╣"
	@echo "║  make dev          → Modo desarrollo      ║"
	@echo "║  make build        → Build Docker image   ║"
	@echo "║  make start        → Levantar (Docker)    ║"
	@echo "║  make start-prod   → Con nginx + backup   ║"
	@echo "║  make stop         → Detener              ║"
	@echo "║  make restart      → Reiniciar            ║"
	@echo "║  make logs         → Ver logs             ║"
	@echo "║  make backup       → Backup manual        ║"
	@echo "║  make test         → Ejecutar tests       ║"
	@echo "║  make clean        → Limpiar containers   ║"
	@echo "║  make status       → Estado del sistema   ║"
	@echo "╚═══════════════════════════════════════════╝"

dev: ## Modo desarrollo (sin Docker)
	npm run dev

build: ## Build Docker image
	docker compose build

start: ## Levantar servicios (sin nginx)
	docker compose up -d

start-prod: ## Levantar con nginx + backup (producción)
	docker compose --profile production up -d

stop: ## Detener servicios
	docker compose down

restart: ## Reiniciar app
	docker compose restart app

logs: ## Ver logs en tiempo real
	docker compose logs -f app

logs-all: ## Ver logs de todos los servicios
	docker compose --profile production logs -f

backup: ## Backup manual de la base de datos
	./scripts/backup.sh

test: ## Ejecutar tests
	npm test

typecheck: ## Verificar tipos TypeScript
	npx tsc --noEmit

clean: ## Limpiar containers y imágenes
	docker compose down --rmi local --volumes --remove-orphans

status: ## Estado de los servicios
	docker compose ps
	@echo ""
	@curl -s http://localhost:3000/health 2>/dev/null | python3 -m json.tool || echo "App no disponible"

ssl: ## Configurar SSL (requiere dominio)
	@read -p "Dominio: " domain; ./scripts/setup-ssl.sh $$domain

update: ## Actualizar a última versión
	git pull
	docker compose build
	docker compose up -d
	@echo "✅ Actualizado"
