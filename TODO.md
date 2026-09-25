# Matcha — remaining work before the defense

Checked against the official evaluation sheet (42 EvalHub, `matcha`).
Reminder: any console error/warning or any 5xx response during the defense counts as a **Crash**.

## Done (commit `7102fa4`)

- [x] Chat backend: `/api/chat` routes, socket events `chat:send` / `chat:message` / `chat:read`, `message` notification (global badge shows it from any page)
- [x] Unit tests for password strength, profile completion, fame rating
- [x] Removed `Readme.md`
- [x] Backend returns `isOnline` on public profiles

## Done (this pass)

- [x] [.env.example](.env.example): `POSTGRES_PORT` fixed to `5433`, `JWT_SECRET`/`COOKIE_SECRET` now ≥32 chars
- [x] `FRONTEND_URL` fixed to `5175` in [.env.example](.env.example) and [env.ts](backend/src/config/env.ts)
- [x] `make test` no longer needs a `.env`: added [vitest.config.ts](backend/vitest.config.ts) + [vitest.setup.ts](backend/vitest.setup.ts) that inject dummy env vars before tests import `env.ts`
- [x] **Geolocation fallback**: new [geolocation.service.ts](backend/src/services/geolocation.service.ts) (offline `geoip-lite` + chained free IP-geolocation APIs) behind `GET /api/profile/geolocate`; [ProfileView.vue](frontend/src/views/ProfileView.vue) calls it automatically when the browser GPS prompt is denied/unsupported. Also fixed a related bug where saving a profile with an empty city (GPS/IP-only location) was rejected by validation.
- [x] **Suggestions sort & filter**: client-side filter/sort controls (age, location, fame, common tags, distance, best match) added to [HomeView.vue](frontend/src/views/HomeView.vue)
- [x] **Suggestion weighting**: replaced the lexicographic `ORDER BY` with a weighted `match_score` (same city + shared tags + fame + proximity decay) in [discovery.routes.ts](backend/src/routes/discovery.routes.ts)
- [x] **Public profile**: `isOnline` / `lastConnection` now displayed in [PublicProfileView.vue](frontend/src/views/PublicProfileView.vue)
- [x] **Incomplete profile**: router guard in [router/index.ts](frontend/src/router/index.ts) redirects to `/profile` until the profile is complete

All verified with `npm test` (backend, 9/9 passing without `.env`), `vue-tsc -b` (frontend, no errors), and manually in a browser against seeded data (login, suggestions filters/sort/scoring, IP geolocation fallback with GPS denied, profile-completion redirect, public profile online/last-seen).

## To verify manually

- [ ] No errors/warnings in the browser console on every page (logged in and logged out)
- [ ] Firefox and Chrome
- [ ] Mobile / very small screens
- [ ] Login with `blabla' OR 1='1` as password is rejected
- [ ] Script injection in bio, tags, chat messages is displayed as text
- [ ] Blocked user: gone from search/suggestions, no more notifications, no chat

## Cleanup

- [x] `frontend/tsconfig.tsbuildinfo` already untracked and gitignored
- [x] README already says `database/migrations/`

## Defense preparation (both of us must be able to explain)

- [ ] Fame rating formula ([fame-rating.service.ts](backend/src/services/fame-rating.service.ts))
- [ ] Suggestion strategy (orientation, unspecified = bisexual, weighting)
- [ ] Geolocation strategy (GPS + fallback)
- [ ] Security: Argon2id, hashed single-use tokens, parameterized queries, upload validation, httpOnly + sameSite cookie
