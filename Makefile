# =============================================================================
# CORTEX — Makefile for easy commands
# =============================================================================

.PHONY: help install build test run docker-build docker-run publish clean

help: ## Show this help
	@echo "CORTEX CLI — common commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all deps (Python venv + Node + build)
	./install.sh
	cd apps/octogent && pnpm install

build: ## Rebuild dist/cli.mjs and Octogent
	npm run build
	cd apps/octogent && pnpm build

test: ## Run tests
	npm run test

run: ## Run the CLI (use ARGS="..." to pass args)
	./cortex.mjs $(ARGS)

docker-build: ## Build Docker image
	docker build -t cortex:latest .

docker-run: ## Run Docker image (pass ARGS="...")
	docker run -it --rm --env-file .env -v "$(PWD)/workspace:/workspace" cortex:latest $(ARGS)

docker-compose-up: ## Start via docker-compose
	docker-compose up -d

docker-compose-down: ## Stop docker-compose
	docker-compose down

octogent: ## Launch bundled Octogent multi-agent orchestrator (http://127.0.0.1:8787)
	./bin/cortex-octogent

octogent-build: ## (Re)build the bundled Octogent app
	cd apps/octogent && pnpm install && pnpm build

publish: ## Publish to npm
	npm publish --access public

clean: ## Clean build artifacts and venv
	rm -rf dist/ .venv/ node_modules/ logs/

deep-clean: clean ## Clean everything including lockfiles
	rm -f bun.lock package-lock.json
