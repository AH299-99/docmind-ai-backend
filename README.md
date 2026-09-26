# DocMind AI — Backend

[![CI](https://github.com/AH299-99/docmind-ai-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/AH299-99/docmind-ai-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

REST API backend for **DocMind AI**. Sign up, log in, and get AI summaries, simple explanations, and key insights for any text — powered by Google Gemini, with each user's analysis history saved in MongoDB.

## ✨ Features

- 🔐 User signup & login with bcrypt-hashed passwords and JWT tokens
- 🤖 AI text analysis via Google Gemini — `summarize`, `explain`, or `analyze`
- 🕘 Per-user analysis history persisted in MongoDB
- 🛡️ Protected routes with JWT middleware
- 🚦 Rate limiting on auth and AI endpoints, plus security headers
- ✅ Strict request validation on auth endpoints
- ❤️ Health-check endpoint for monitoring / deployment probes

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Auth:** jsonwebtoken + bcryptjs
- **Safety:** helmet, express-rate-limit, dotenv

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or newer
- A MongoDB database ([MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier works)
- A Google Gemini API key ([Google AI Studio](https://aistudio.google.com))

### Installation

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev            # development (nodemon)
# or
npm start              # production
```

### Environment Variables

| Variable             | Required | Description                                                                     |
| -------------------- | -------- | ------------------------------------------------------------------------------- |
| `PORT`               | No       | Port to listen on (default `5000`)                                              |
| `MONGO_URI`          | Yes      | MongoDB connection string (the app refuses to boot without it)                  |
| `JWT_SECRET`         | Yes      | Secret for signing JWTs — use a long random string (boot fails without it)      |
| `GEMINI_API_KEY`     | Yes*     | Google Gemini API key (*only AI features need it; the server boots without it)  |
| `GEMINI_MODEL`       | No       | Gemini model name (default `gemini-2.0-flash`)                                  |
| `FRONTEND_URL`       | No       | Comma-separated allowed frontend origins. When unset, browser cross-origin requests are **denied** (fail-safe); native mobile apps are unaffected |
| `AI_MAX_TEXT_LENGTH` | No       | Max AI input length in characters (default `20000`)                             |

## 📡 API Endpoints

| Method | Endpoint             | Auth | Description                           |
| ------ | -------------------- | ---- | ------------------------------------- |
| GET    | `/`                  | —    | Service banner                        |
| GET    | `/api/health`        | —    | Health check (uptime, timestamp)      |
| POST   | `/api/auth/signup`   | —    | Register (`name`, `email`, `password`) |
| POST   | `/api/auth/login`    | —    | Login → returns JWT `token`           |
| POST   | `/api/ai/analyze`    | JWT  | Analyze text (`text`, `task`)         |

`task` must be `summarize`, `explain`, or `analyze` — it defaults to `analyze` when omitted, and anything else returns `400`. Send the JWT as `Authorization: Bearer <token>`.

### Quick try

```bash
# register
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Sara","email":"sara@example.com","password":"secret123"}'

# log in (copy the token from the response)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sara@example.com","password":"secret123"}'

# analyze text
curl -X POST http://localhost:5000/api/ai/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Paste a long paragraph here...","task":"summarize"}'
```

## 📁 Project Structure

```
index.js               # app entry: middleware, routes, 404 + error handlers
config/db.js           # MongoDB connection
controllers/           # signup/login + AI analysis logic
routes/                # /api/auth and /api/ai route definitions
middleware/            # JWT auth + rate limiters
models/                # User and History (Mongoose schemas)
utils/validation.js    # shared input validation (unit tested)
tests/                 # node:test unit tests (run by CI)
```

## 🧪 Tests

```bash
npm test   # runs automatically on every push via GitHub Actions
```

## ☁️ Deployment

Recommended: **Render** (free tier) + **MongoDB Atlas** (free M0).

1. Push this repo to GitHub (CI runs automatically).
2. Create a **Web Service** on Render from this repo — build command `npm install`, start command `npm start`.
3. Add the environment variables from `.env.example` in Render's dashboard.
4. Render auto-deploys on every push to `main`.

## 📄 License

MIT © 2026 Azmat Hayat — see [LICENSE](LICENSE).
