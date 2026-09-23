# DocMind AI — Backend

REST API backend for **DocMind AI**, an AI-powered document text analysis app. Provides JWT authentication and text analysis (summarize / explain / analyze) powered by Google Gemini, with per-user history stored in MongoDB.

## ✨ Features

- 🔐 User signup & login with bcrypt-hashed passwords and JWT tokens
- 🤖 AI text analysis via Google Gemini (`summarize`, `explain`, `analyze`)
- 🕘 Per-user analysis history persisted in MongoDB
- 🛡️ Protected routes with JWT middleware
- ❤️ Health-check endpoint for monitoring / deployment probes
- ✅ Request validation on auth endpoints

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **Database:** MongoDB (Mongoose)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Auth:** jsonwebtoken + bcryptjs

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

| Variable         | Description                                        |
| ---------------- | -------------------------------------------------- |
| `PORT`           | Port to listen on (default `5000`)                 |
| `MONGO_URI`      | MongoDB connection string                          |
| `JWT_SECRET`     | Secret for signing JWTs (long random string)       |
| `GEMINI_API_KEY` | Google Gemini API key                              |
| `GEMINI_MODEL`   | Gemini model name (default `gemini-2.0-flash`)     |
| `FRONTEND_URL`  | Comma-separated allowed web origins (empty = deny web CORS) |

## 📡 API Endpoints

| Method | Endpoint             | Auth | Description                          |
| ------ | -------------------- | ---- | ------------------------------------ |
| GET    | `/`                  | —    | Service banner                       |
| GET    | `/api/health`        | —    | Health check                         |
| POST   | `/api/auth/signup`   | —    | Register (`name`, `email`, `password`)|
| POST   | `/api/auth/login`    | —    | Login → returns JWT `token`          |
| POST   | `/api/ai/analyze`    | JWT  | Analyze text (`text`, `task`)        |

`task` must be `summarize`, `explain`, or `analyze`. Text input is limited to 12,000 characters. Send the JWT as `Authorization: Bearer <token>`.

## ☁️ Deployment

Recommended: **Render** (free tier) + **MongoDB Atlas** (free M0).

1. Push this repo to GitHub (CI runs automatically).
2. Create a **Web Service** on Render from this repo — build command `npm install`, start command `npm start`.
3. Add the environment variables from `.env.example` in Render's dashboard.
4. Render auto-deploys on every push to `main`.

## 📄 License

MIT — see [LICENSE](LICENSE).
