Frontend: Vue 3 + TypeScript + Tailwind CSS
Backend: Node.js + Fastify + TypeScript
Database: PostgreSQL with manually written SQL queries
Real-time: Socket.IO
Containers: Docker Compose with a named PostgreSQL volume
Testing: Vitest and API integration tests

Day 1	Project setup, Docker, database design and authentication
Day 2	Profile management, tags, pictures and location
Day 3	Profile browsing, compatibility, search, filters and sorting
Day 4	Likes, connections, visits, blocks, reports and fame rating
Day 5	Real-time chat, notifications and online status
Day 6	Generate 500 profiles, frontend improvements and responsive design
Day 7	Security testing, bug fixes, documentation and defense preparation

11e1ed1a0d4dcfbf8050cd5876c927bfe6e715768dd12ff67148a10e82acafc6

to check if a reset tokem was created
docker exec matcha_postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT token_type, expires_at, used_at, created_at FROM account_tokens ORDER BY created_at DESC;"'

how to generate fresh token 
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"rebecca4@example.com"}'