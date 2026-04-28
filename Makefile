.PHONY: help up down build logs shell-backend shell-db migrate seed test lint

# ── Colors ─────────────────────────────────────────────────────────────────
CYAN  = \033[0;36m
RESET = \033[0m

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

# ── Docker ─────────────────────────────────────────────────────────────────
up: ## Start all services
	docker compose up -d

up-build: ## Rebuild and start all services
	docker compose up -d --build

down: ## Stop all services
	docker compose down

down-volumes: ## Stop and remove all volumes (DATA LOSS!)
	docker compose down -v

logs: ## Tail logs (all services)
	docker compose logs -f

logs-backend: ## Tail backend logs
	docker compose logs -f backend

logs-db: ## Tail database logs
	docker compose logs -f db

# ── Dev shells ─────────────────────────────────────────────────────────────
shell-backend: ## Open shell in backend container
	docker compose exec backend bash

shell-db: ## Open psql in database container
	docker compose exec db psql -U icfes -d icfes_db

shell-redis: ## Open redis-cli
	docker compose exec redis redis-cli

# ── Backend ────────────────────────────────────────────────────────────────
dev-backend: ## Run backend in dev mode (local)
	cd backend && uvicorn app.main:app --reload --port 8000

install-backend: ## Install Python dependencies
	cd backend && pip install -r requirements.txt

migrate: ## Run Alembic migrations
	docker compose exec backend alembic upgrade head

migrate-local: ## Run migrations locally
	cd backend && alembic upgrade head

migration: ## Create new migration (use: make migration MSG="add table")
	docker compose exec backend alembic revision --autogenerate -m "$(MSG)"

# ── Frontend ───────────────────────────────────────────────────────────────
dev-frontend: ## Run frontend in dev mode
	cd frontend && npm run dev

install-frontend: ## Install Node dependencies
	cd frontend && npm install

build-frontend: ## Build frontend for production
	cd frontend && npm run build

# ── Code quality ───────────────────────────────────────────────────────────
lint: ## Lint backend (ruff) and frontend (eslint)
	cd backend && python -m ruff check app/ --fix
	cd frontend && npm run lint

type-check: ## Type-check frontend (tsc)
	cd frontend && npm run type-check

format: ## Format Python code
	cd backend && python -m ruff format app/

# ── Database ───────────────────────────────────────────────────────────────
db-reset: ## Reset DB (drops and recreates with seed data)
	docker compose exec db psql -U icfes -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker compose exec db psql -U icfes -d icfes_db -f /docker-entrypoint-initdb.d/init.sql

db-dump: ## Dump database to backup.sql
	docker compose exec db pg_dump -U icfes icfes_db > backup_$(shell date +%Y%m%d_%H%M%S).sql

# ── Health checks ──────────────────────────────────────────────────────────
health: ## Check all service health
	@echo "$(CYAN)Backend$(RESET)"
	@curl -sf http://localhost/health | python3 -m json.tool
	@echo "\n$(CYAN)Database$(RESET)"
	@docker compose exec db pg_isready -U icfes -d icfes_db
	@echo "\n$(CYAN)Redis$(RESET)"
	@docker compose exec redis redis-cli ping

# ── Production ─────────────────────────────────────────────────────────────
prod-deploy: ## Deploy to production (SSH)
	docker compose -f docker-compose.yml pull
	docker compose -f docker-compose.yml up -d --remove-orphans
	docker image prune -f

open: ## Open browser to local dev
	open http://localhost

open-docs: ## Open API docs
	open http://localhost/api/docs

open-minio: ## Open MinIO console
	open http://localhost:9001
