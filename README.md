# Matcha

Matcha is a full-stack dating web application built with Vue, Fastify, PostgreSQL and Socket.IO.

Users can create profiles, upload pictures, select interests, discover compatible profiles, search using filters, interact with other users and exchange real-time messages after forming a mutual connection.

## Features

### Authentication

- Account registration
- Email verification
- Secure login and logout
- HTTP-only authentication cookies
- Forgot-password and password-reset emails
- Argon2id password hashing
- Password-strength validation
- Request rate limiting

### Profiles

- Personal information and biography
- Gender and sexual preferences
- Birth date and adult-age validation
- Interests and tags
- Manual city and neighbourhood
- Optional geographic coordinates
- Up to five profile pictures
- Main profile picture selection
- Automatic profile-completion calculation
- Fame rating

### Discovery and search

- Suggested compatible profiles
- Sexual-preference filtering
- Age and fame-rating filters
- City and interest filters
- Distance calculation when coordinates are available
- Sorting by age, distance, fame rating or common interests
- Public profile pages

### Social interactions

- Profile visits
- Like and unlike
- Mutual connections
- Block and unblock
- Report users
- Visitors, received likes and connections pages

### Notifications

- Likes
- Matches
- Profile visits
- Messages
- Unlikes
- Unread-notification counter
- Mark one or all notifications as read
- Real-time notification delivery

### Chat

- Chat restricted to mutual connections
- Conversation list
- Message history
- Real-time message delivery with Socket.IO
- Read status
- Unread-message counters
- Online and offline status
- Last connection time

## Technology stack

### Backend

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Socket.IO
- JSON Web Tokens
- Argon2
- Zod
- Vitest

### Frontend

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Axios
- Socket.IO Client

### Development infrastructure

- Docker Compose
- PostgreSQL 16
- Mailpit
- Makefile
- SQL migrations

## Requirements

Install the following tools before starting:

- Node.js 20 or later
- npm
- Docker
- Docker Compose
- GNU Make

Check the installed versions:

```bash
node --version
npm --version
docker --version
docker compose version
make --version
```

## Project structure

```text
matcha/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── router/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── views/
│   │   └── App.vue
│   └── package.json
├── migrations/
├── scripts/
│   └── migrate.sh
├── compose.yaml
├── Makefile
└── .env.example
```

## Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/Rtijani/matcha.git
cd matcha
git switch develop
```

Install the backend and frontend dependencies:

```bash
make install
```

Create the environment file:

```bash
cp .env.example .env
```

Generate secure secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Place the generated values in `.env` as `JWT_SECRET` and `COOKIE_SECRET`.

Example development configuration:

```env
NODE_ENV=development

BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
FRONTEND_URL=http://localhost:5174

POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=matcha
POSTGRES_USER=matcha
POSTGRES_PASSWORD=replace_with_a_secure_password

JWT_SECRET=replace_with_a_long_random_secret
COOKIE_SECRET=replace_with_another_long_random_secret

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=Matcha <no-reply@matcha.local>
```

Never commit the real `.env` file.

## Database setup

Start PostgreSQL and Mailpit, then apply all pending migrations:

```bash
make migrate
```

The migration system records applied migration files in the `schema_migrations` table. Running the command again only applies migrations that have not already been executed.

To populate the database with development profiles:

```bash
make seed
```

The seed command is optional and intended for development and demonstration. Avoid repeatedly seeding an already populated database.

Docker data is stored in named volumes:

- `matcha_postgres_data`
- `matcha_mailpit_data`

Consequently, stopping the containers does not delete the database or saved Mailpit messages.

## Running the application

Start the complete development environment:

```bash
make dev
```

This command:

1. Starts PostgreSQL and Mailpit.
2. Waits for PostgreSQL to become ready.
3. Applies pending migrations.
4. Starts the Fastify backend.
5. Starts the Vite frontend.

Development services are available at:

| Service | Address |
|---|---|
| Frontend | `http://localhost:5174` |
| Backend | `http://localhost:3000` |
| Health endpoint | `http://localhost:3000/health` |
| Mailpit interface | `http://localhost:8025` |
| PostgreSQL | `localhost:5433` |

Stop the development processes with `Ctrl+C`.

Stop the Docker services with:

```bash
make stop
```

## Email verification

Development emails are captured by Mailpit instead of being delivered to real email addresses.

After registering:

1. Open `http://localhost:8025`.
2. Open the Matcha verification email.
3. Follow the verification link.
4. Return to Matcha and log in.

Password-reset messages are available through the same Mailpit interface.

## Available Make commands

| Command | Description |
|---|---|
| `make install` | Install backend and frontend dependencies |
| `make up` | Start PostgreSQL and Mailpit |
| `make migrate` | Start services and apply pending migrations |
| `make seed` | Apply migrations and generate development profiles |
| `make dev` | Start the complete development environment |
| `make build` | Build the backend and frontend |
| `make test` | Run backend automated tests |
| `make status` | Display Docker service status |
| `make stop` | Stop Docker services |
| `make clean` | Stop services and remove generated build directories |

`make clean` does not remove the named database volumes.

## Tests

Run the backend unit tests:

```bash
make test
```

The current tests cover:

- Password-strength validation
- Profile-completion calculation
- Fame-rating calculation

Run production compilation checks:

```bash
make build
```

Both commands should complete successfully before committing changes.

## Manual evaluation workflow

For a complete functional test, create two verified accounts and complete both profiles.

Each complete profile requires:

- Gender
- Sexual preference
- Biography
- Birth date
- At least one interest
- A main profile picture
- Either geographic coordinates or a manually entered city

Then verify:

1. Both users appear in discovery or search.
2. One user can visit and like the other.
3. The second user receives the appropriate notifications.
4. The second user likes the first user.
5. A mutual connection is created.
6. The users can exchange real-time chat messages.
7. Message read status and unread counters update.
8. Blocking removes access to interactions and chat.
9. Reporting a user succeeds.
10. Logout prevents access to authenticated pages.

## Fresh-install evaluation

To test the project from a clean clone:

```bash
git clone https://github.com/Rtijani/matcha.git
cd matcha
git switch develop
make install
cp .env.example .env
```

Replace the secrets in `.env`, then run:

```bash
make migrate
make seed
make test
make build
make dev
```

Open the frontend at `http://localhost:5174`.

## Security considerations

The application includes:

- Argon2id password hashing
- Password-strength checking
- Hashed verification and password-reset tokens
- Expiring and single-use account tokens
- HTTP-only authentication cookies
- Request validation with Zod
- Rate limiting on sensitive routes
- Parameterized PostgreSQL queries
- File type and size validation
- Authentication middleware
- Mutual-connection checks for chat
- Block checks for profile access and interactions
- Protected notification ownership
- Environment-based secrets

Verification and password-reset tokens are sent by email and are not exposed in API responses.

## Final checks

Before committing:

```bash
make test
make build
git status --short
```

Ensure that none of the following are tracked:

- `.env`
- `node_modules`
- `dist`
- Uploaded profile pictures
- Database files
- Development secrets

Check with:

```bash
git ls-files | grep -E '(^|/)\.env$|node_modules|(^|/)dist/|(^|/)uploads/'
```

A correct result produces no output.