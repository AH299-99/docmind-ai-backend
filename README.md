# DocMind AI — Backend

[![CI](https://github.com/AH299-99/docmind-ai-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/AH299-99/docmind-ai-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

REST API backend for **DocMind AI**. Sign up, log in, and get AI summaries, simple explanations, and key insights for any text — powered by Google Gemini, with each user's analysis history saved in MongoDB.

## ✨ Features

- 🔐 User signup & login with bcrypt-hashed passwords and JWT tokens
- 🤖 AI text analysis via Google Gemini — `summarize`, `explain`, or `analyze`
- 📄 Document upload (`.pdf`, `.docx`, `.txt` up to 10MB) — text is extracted and run through the same AI analysis
- 📝 Assignment writer — generates a complete, original assignment (title, introduction, headed sections, conclusion) in a natural human tone
- 📥 Export to file — download any content as `.pdf`, `.docx`, or `.txt`
- 🕘 Per-user analysis history persisted in MongoDB
- 🛡️ Protected routes with JWT middleware
- 🚦 Rate limiting on auth and AI endpoints, plus security headers
- ✅ Strict request validation on auth endpoints
- ❤️ Health-check endpoint for monitoring / deployment probes

All AI output follows one house rule: it must read like a real person wrote it. Simple everyday words, mixed sentence lengths, and a list of banned AI clichés (`delve`, `moreover`, `furthermore`, `in conclusion`, `tapestry`, `landscape`, `it's important to note`, `as an AI`) that the model is told never to use.

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Auth:** jsonwebtoken + bcryptjs
- **Files:** multer (uploads), pdf-parse + mammoth (text extraction), pdfkit + docx (exports)
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

No new environment variables were needed for the upload / assignment / export features — everything runs on the existing config above.

## 📡 API Endpoints

| Method | Endpoint             | Auth | Description                                                     |
| ------ | -------------------- | ---- | --------------------------------------------------------------- |
| GET    | `/`                  | —    | Service banner                                                  |
| GET    | `/api/health`        | —    | Health check (uptime, timestamp)                                |
| POST   | `/api/auth/signup`   | —    | Register (`name`, `email`, `password`)                           |
| POST   | `/api/auth/login`    | —    | Login → returns JWT `token`                                     |
| POST   | `/api/ai/analyze`    | JWT  | Analyze text (`text`, `task`)                                   |
| POST   | `/api/ai/upload`     | JWT  | Upload a document (`document` file + `task`), get AI analysis    |
| POST   | `/api/ai/assignment` | JWT  | Generate an assignment (`topic`, `instructions?`, `level?`, `length?`) |
| POST   | `/api/ai/export`     | JWT  | Export content to a file (`title?`, `content`, `format`)        |

`task` must be `summarize`, `explain`, or `analyze` — it defaults to `analyze` when omitted, and anything else returns `400`. Send the JWT as `Authorization: Bearer <token>`.

### Upload a document

Send `multipart/form-data` with the file in the `document` field. Only `.pdf`, `.docx`, and `.txt` files are accepted, max 10MB. The optional `task` field works like `/analyze` (defaults to `summarize`). The response includes the extracted character count.

```bash
curl -X POST http://localhost:5000/api/ai/upload \
  -H "Authorization: Bearer <token>" \
  -F "document=@notes.pdf" \
  -F "task=summarize"
# {"result":"...","task":"summarize","filename":"notes.pdf","charsExtracted":4821}
```

### Generate an assignment

`topic` is required. `level` must be `school`, `college`, or `university` (default `college`); `length` must be `short` (~400 words), `medium` (~900 words), or `long` (~1600 words, default `medium`). Bad values return `400`.

```bash
curl -X POST http://localhost:5000/api/ai/assignment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Photosynthesis","level":"college","length":"medium","instructions":"Keep it simple"}'
# {"title":"Photosynthesis: How Plants Make Food","result":"..."}
```

### Export to a file

`content` is required, `format` must be `pdf`, `docx`, or `txt` (`400` otherwise). The file downloads as an attachment; the filename comes from a slugified `title`, or `docmind-export` when no title is given.

```bash
curl -X POST http://localhost:5000/api/ai/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Report","content":"First paragraph.\n\nSecond paragraph.","format":"pdf"}' \
  --output my-report.pdf
```

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
controllers/           # signup/login + AI logic (analyze, upload, assignment, export)
routes/                # /api/auth and /api/ai route definitions
middleware/            # JWT auth, rate limiters, multer upload handling
models/                # User and History (Mongoose schemas)
utils/validation.js    # shared input validation (unit tested)
utils/humanTone.js     # the human-tone writing rules applied to all AI output
utils/aiClient.js      # Gemini API wrapper
utils/documents.js     # file extraction, assignment prompts, export builders (unit tested)
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
