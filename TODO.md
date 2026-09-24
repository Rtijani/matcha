# Matcha — remaining work before the defense

Checked against the official evaluation sheet (42 EvalHub, `matcha`).
Reminder: any console error/warning or any 5xx response during the defense counts as a **Crash**.

## Done (commit `7102fa4`)

- [x] Chat backend: `/api/chat` routes, socket events `chat:send` / `chat:message` / `chat:read`, `message` notification (global badge shows it from any page)
- [x] Unit tests for password strength, profile completion, fame rating
- [x] Removed `Readme.md`
- [x] Backend returns `isOnline` on public profiles

## Fresh install (the evaluator redoes the whole installation)

- [ ] [.env.example](.env.example): `POSTGRES_PORT` must be `5433` (Docker maps `5433:5432`)
- [ ] [.env.example](.env.example): `JWT_SECRET` / `COOKIE_SECRET` are shorter than 32 characters, so the backend exits on start
- [ ] Frontend port mismatch: Vite runs on `5175` ([vite.config.ts](frontend/vite.config.ts)), README now says `5175`, but `FRONTEND_URL` is still `5174` in [.env.example](.env.example) and [env.ts](backend/src/config/env.ts), so email verification/reset links point to the wrong port
- [ ] `make test` fails without a `.env`: importing `env.ts` calls `process.exit(1)` (2 of 3 test files crash). Either make the services independent of `env.ts` or document that `.env` is required first.

## Evaluation sheet items not fully met

- [ ] **Geolocation fallback**: if the user refuses GPS, they must still be located (e.g. IP-based lookup on the backend). Currently only manual city entry ([ProfileView.vue](frontend/src/views/ProfileView.vue)).
- [ ] **Suggestions sort & filter**: the home page suggestion list must be sortable/filterable by age, location, fame rating, tags (search already does it) — [HomeView.vue](frontend/src/views/HomeView.vue)
- [ ] **Suggestion weighting**: `ORDER BY same_city, distance, common_tags, fame` is lexicographic, so tags and fame almost never matter. Use a weighted score combining distance, common tags and fame ([discovery.routes.ts](backend/src/routes/discovery.routes.ts)).
- [ ] **Public profile**: show online status, or last connection date/time when offline. Backend returns `isOnline` and `lastConnection`; display both in [PublicProfileView.vue](frontend/src/views/PublicProfileView.vue).
- [ ] **Incomplete profile**: user should not access the site until the profile is complete. Add a check in the router guard ([router/index.ts](frontend/src/router/index.ts)) redirecting to `/profile`.

## To verify manually

- [ ] No errors/warnings in the browser console on every page (logged in and logged out)
- [ ] Firefox and Chrome
- [ ] Mobile / very small screens
- [ ] Login with `blabla' OR 1='1` as password is rejected
- [ ] Script injection in bio, tags, chat messages is displayed as text
- [ ] Blocked user: gone from search/suggestions, no more notifications, no chat

## Cleanup

- [ ] Untrack `frontend/tsconfig.tsbuildinfo` and add it to `.gitignore`
- [ ] README: project structure says `migrations/`, actual folder is `database/migrations/`

## Defense preparation (both of us must be able to explain)

- [ ] Fame rating formula ([fame-rating.service.ts](backend/src/services/fame-rating.service.ts))
- [ ] Suggestion strategy (orientation, unspecified = bisexual, weighting)
- [ ] Geolocation strategy (GPS + fallback)
- [ ] Security: Argon2id, hashed single-use tokens, parameterized queries, upload validation, httpOnly + sameSite cookie
