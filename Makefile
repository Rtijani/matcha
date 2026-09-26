SHELL := /bin/sh

.PHONY: install up migrate seed dev test stop clean status  mailpit mailpit-logs harshed-password

install:
	cd backend && npm install
	cd frontend && npm install

up:
	docker compose up -d
	@echo "Waiting for PostgreSQL..."
	@until docker exec matcha_postgres pg_isready \
		-U "$$POSTGRES_USER" \
		-d "$$POSTGRES_DB" >/dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "PostgreSQL is ready."

migrate: up
	./scripts/migrate.sh

seed: migrate
	cd backend && npx tsx src/database/seed.ts

dev: migrate
	@backend_pid=""; frontend_pid=""; \
	cleanup() { \
		[ -z "$$backend_pid" ] || kill "$$backend_pid" 2>/dev/null || true; \
		[ -z "$$frontend_pid" ] || kill "$$frontend_pid" 2>/dev/null || true; \
	}; \
	trap cleanup EXIT INT TERM; \
	(cd backend && npm run dev) & backend_pid=$$!; \
	(cd frontend && npm run dev) & frontend_pid=$$!; \
	wait

test:
	cd backend && npm test

stop:
	docker compose down

clean:
	docker compose down
	rm -rf backend/dist frontend/dist

status:
	docker compose ps

mailpit:
	docker compose up -d mailpit
	@echo "Mailpit is running."
	@echo "Web interface: http://localhost:8025"
	@echo "SMTP server: localhost:1025"

mailpit-logs:
	docker logs --tail 100 matcha_mailpit

	
harshed-password:
	docker exec matcha_postgres sh -c \
	'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
	SELECT
	username,
	left(password_hash, 20) AS hash_prefix
	FROM users
	LIMIT 5;
	"'