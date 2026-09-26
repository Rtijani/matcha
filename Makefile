SHELL := /bin/sh

.PHONY: \
	install setup demo up migrate seed dev build test verify \
	stop clean status doctor \
	mailpit mailpit-logs \
	db-tables db-migrations db-counts db-users db-profiles \
	db-fame db-location db-social hashed-password \
	harshed-password evaluation

install:
	cd backend && npm install
	cd frontend && npm install

setup: install migrate
	@echo ""
	@echo "Matcha setup completed."
	@echo "Run 'make dev' to start the application."

demo: setup seed
	@echo ""
	@echo "Matcha is ready with demonstration profiles."

up:
	docker compose up -d
	@echo "Waiting for PostgreSQL..."
	@until docker exec matcha_postgres sh -c \
		'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' \
		>/dev/null 2>&1; do \
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
		[ -z "$$backend_pid" ] || \
			kill "$$backend_pid" 2>/dev/null || true; \
		[ -z "$$frontend_pid" ] || \
			kill "$$frontend_pid" 2>/dev/null || true; \
	}; \
	trap cleanup EXIT INT TERM; \
	(cd backend && npm run dev) & backend_pid=$$!; \
	(cd frontend && npm run dev) & frontend_pid=$$!; \
	wait

build:
	cd backend && npm run build
	cd frontend && npm run build

test:
	cd backend && npm test

verify: migrate test build
	@echo ""
	@echo "Migrations, tests and builds passed."

evaluation: verify
	@$(MAKE) db-migrations
	@$(MAKE) db-counts
	@$(MAKE) db-profiles
	@$(MAKE) db-fame
	@$(MAKE) db-location
	@$(MAKE) db-social
	@$(MAKE) hashed-password
	@echo ""
	@echo "Automated evaluation checks completed."
	@echo "Manual browser and two-account tests are still required."

stop:
	docker compose down

clean:
	docker compose down
	rm -rf backend/dist frontend/dist
	@echo "Build directories removed."
	@echo "Database volumes were preserved."

status:
	docker compose ps

doctor:
	@echo "Node:"
	@node --version
	@echo ""
	@echo "npm:"
	@npm --version
	@echo ""
	@echo "Docker:"
	@docker --version
	@echo ""
	@echo "Docker Compose:"
	@docker compose version
	@echo ""
	@echo "Git branch:"
	@git status -sb
	@echo ""
	@if [ -f .env ]; then \
		echo ".env exists."; \
	else \
		echo "ERROR: .env is missing."; \
		exit 1; \
	fi
	@echo ""
	@echo "Important development configuration:"
	@grep -E \
		'^(BACKEND_PORT|FRONTEND_URL|POSTGRES_HOST|POSTGRES_PORT|POSTGRES_DB|SMTP_HOST|SMTP_PORT)=' \
		.env || true

mailpit:
	docker compose up -d mailpit
	@echo "Mailpit is running."
	@echo "Web interface: http://localhost:8025"
	@echo "SMTP server: localhost:1025"

mailpit-logs:
	docker logs --tail 100 matcha_mailpit

db-tables: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" \
		-c "\dt"'

db-migrations: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" \
		-c "SELECT filename, applied_at \
		FROM schema_migrations \
		ORDER BY filename;"'

db-counts: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT COUNT(*) AS users FROM users; \
		SELECT COUNT(*) AS profiles FROM profiles; \
		SELECT COUNT(*) AS pictures FROM profile_pictures; \
		SELECT COUNT(*) AS tags FROM tags; \
		SELECT COUNT(*) AS user_tags FROM user_tags; \
		"'

db-users: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT \
			username, \
			email, \
			is_verified, \
			is_profile_complete, \
			last_login_at, \
			created_at \
		FROM users \
		ORDER BY created_at DESC \
		LIMIT 50; \
		"'

db-profiles: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT \
			users.username, \
			users.is_verified, \
			users.is_profile_complete, \
			profiles.gender, \
			profiles.sexual_preference, \
			profiles.city, \
			COUNT(DISTINCT user_tags.tag_id) AS interests, \
			COUNT(DISTINCT profile_pictures.id) \
				FILTER ( \
					WHERE profile_pictures.is_profile_picture = TRUE \
				) AS main_pictures \
		FROM users \
		LEFT JOIN profiles \
			ON profiles.user_id = users.id \
		LEFT JOIN user_tags \
			ON user_tags.user_id = users.id \
		LEFT JOIN profile_pictures \
			ON profile_pictures.user_id = users.id \
		GROUP BY \
			users.id, \
			profiles.user_id \
		ORDER BY users.created_at DESC \
		LIMIT 50; \
		"'

db-fame: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT \
			users.username, \
			COUNT(likes.liker_id) AS received_likes, \
			profiles.fame_rating, \
			LEAST( \
				100, \
				COUNT(likes.liker_id)::integer * 5 \
			) AS expected_fame_rating \
		FROM users \
		JOIN profiles \
			ON profiles.user_id = users.id \
		LEFT JOIN likes \
			ON likes.liked_id = users.id \
		GROUP BY \
			users.id, \
			profiles.fame_rating \
		ORDER BY profiles.fame_rating DESC \
		LIMIT 50; \
		"'

db-location: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT \
			users.username, \
			profiles.location_consent, \
			profiles.latitude, \
			profiles.longitude, \
			profiles.city, \
			profiles.neighborhood \
		FROM users \
		JOIN profiles \
			ON profiles.user_id = users.id \
		ORDER BY users.created_at DESC \
		LIMIT 50; \
		"'

db-social: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT COUNT(*) AS likes FROM likes; \
		SELECT COUNT(*) AS profile_views FROM profile_views; \
		SELECT COUNT(*) AS blocks FROM blocks; \
		SELECT COUNT(*) AS reports FROM reports; \
		SELECT COUNT(*) AS notifications FROM notifications; \
		SELECT COUNT(*) AS messages FROM messages; \
		"'

hashed-password: up
	docker exec matcha_postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c " \
		SELECT \
			username, \
			left(password_hash, 20) AS hash_prefix \
		FROM users \
		ORDER BY created_at DESC \
		LIMIT 5; \
		"'

# Compatibility alias for the previous misspelled command.
harshed-password: hashed-password